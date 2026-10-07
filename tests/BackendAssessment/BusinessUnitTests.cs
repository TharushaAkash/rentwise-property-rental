using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using RentWise.API.Common.Interfaces;
using RentWise.API.Data;
using RentWise.API.Modules.Agreements.Controllers;
using RentWise.API.Modules.Agreements.Entities;
using RentWise.API.Modules.Agreements.Interfaces;
using RentWise.API.Modules.Agreements.Services;
using RentWise.API.Modules.Maintenance.Entities;
using RentWise.API.Modules.Maintenance.Services;
using RentWise.API.Modules.PropertyManagement.Controllers;
using RentWise.API.Modules.PropertyManagement.Entities;
using RentWise.API.Modules.PropertyManagement.Interfaces;
using Microsoft.Extensions.Configuration;

namespace BackendAssessment;

public sealed class BusinessUnitTests
{
    private static ApplicationDbContext MemoryDb() => new(new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private static ControllerContext Actor(Guid actor, string role) => new() {
        HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(new[] {
            new Claim(ClaimTypes.NameIdentifier, actor.ToString()), new Claim(ClaimTypes.Role, role),
        }, "unit-test")) },
    };
    [Fact, Trait("Area", "Unit")]
    public async Task API_08_Owner_cannot_create_agreement_for_another_owners_property()
    {
        await using var db = MemoryDb();
        var property = new Property { OwnerId = Guid.NewGuid(), Title = "Other owner's house", Address = "Colombo", Description = "House description" };
        db.Properties.Add(property); await db.SaveChangesAsync();
        var service = new Mock<IRentalAgreementService>(MockBehavior.Strict);
        var email = new Mock<IBookingConfirmationEmailSender>(MockBehavior.Strict);
        var controller = new RentalAgreementsController(service.Object, db, email.Object, NullLogger<RentalAgreementsController>.Instance) {
            ControllerContext = Actor(Guid.NewGuid(), "PropertyOwner"),
        };
        var result = await controller.CreateAgreement(new RentalAgreement { PropertyId = property.Id, TenantId = Guid.NewGuid() });
        Assert.IsType<ForbidResult>(result);
        service.Verify(s => s.CreateAgreementAsync(It.IsAny<RentalAgreement>()), Times.Never);
        email.VerifyNoOtherCalls();
        Assert.Empty(db.RentalAgreements);
    }
    [Fact, Trait("Area", "Unit")]
    public async Task API_08_Missing_property_blocks_agreement_creation()
    {
        await using var db = MemoryDb();
        var service = new Mock<IRentalAgreementService>(MockBehavior.Strict);
        var email = new Mock<IBookingConfirmationEmailSender>(MockBehavior.Strict);
        var controller = new RentalAgreementsController(service.Object, db, email.Object, NullLogger<RentalAgreementsController>.Instance) {
            ControllerContext = Actor(Guid.NewGuid(), "PropertyOwner"),
        };
        Assert.IsType<NotFoundResult>(await controller.CreateAgreement(new RentalAgreement { PropertyId = Guid.NewGuid() }));
        service.Verify(s => s.CreateAgreementAsync(It.IsAny<RentalAgreement>()), Times.Never);
    }
    [Fact, Trait("Area", "Unit")]
    public async Task API_10_Maintenance_service_forwards_changed_status_to_repository()
    {
        var request = new MaintenanceRequest { Description = "Leaking tap", Status = MaintenanceStatus.InProgress };
        var repository = new Mock<IRepository<MaintenanceRequest>>(MockBehavior.Strict);
        repository.Setup(r => r.UpdateAsync(It.Is<MaintenanceRequest>(m => m.Id == request.Id && m.Status == MaintenanceStatus.InProgress))).Returns(Task.CompletedTask);
        await new MaintenanceRequestService(repository.Object).UpdateRequestAsync(request);
        repository.Verify(r => r.UpdateAsync(It.Is<MaintenanceRequest>(m => m.Id == request.Id && m.Status == MaintenanceStatus.InProgress)), Times.Once);
        repository.VerifyNoOtherCalls();
    }
    [Fact, Trait("Area", "Unit")]
    public async Task API_10_Repository_failure_is_not_reported_as_success()
    {
        var request = new MaintenanceRequest { Status = MaintenanceStatus.Completed };
        var repository = new Mock<IRepository<MaintenanceRequest>>(MockBehavior.Strict);
        repository.Setup(r => r.UpdateAsync(request)).ThrowsAsync(new InvalidOperationException("storage failure"));
        await Assert.ThrowsAsync<InvalidOperationException>(() => new MaintenanceRequestService(repository.Object).UpdateRequestAsync(request));
    }
    [Theory, Trait("Area", "Unit")]
    [InlineData(-1, 12)][InlineData(0, 0)][InlineData(0, 49)]
    public async Task API_06_Invalid_filters_rejected_before_service_access(decimal min, int size)
    {
        await using var db = MemoryDb();
        var service = new Mock<IPropertyService>(MockBehavior.Strict);
        var controller = new PropertiesController(service.Object, db, new ConfigurationBuilder().Build());
        Assert.IsType<BadRequestObjectResult>(await controller.Browse(null, min, null, null, pageSize: size));
        service.VerifyNoOtherCalls();
    }
    [Theory, Trait("Area", "Unit")]
    [InlineData("Completed", true)][InlineData("InvalidStatus", false)]
    public async Task API_10_Status_validation_updates_only_valid_values_and_records_history(string status, bool valid)
    {
        await using var db = MemoryDb();
        var tenantId = Guid.NewGuid();
        var request = new MaintenanceRequest { TenantId = tenantId, PropertyId = Guid.NewGuid(), Description = "Leaking tap" };
        db.MaintenanceRequests.Add(request); await db.SaveChangesAsync();
        var service = new Mock<RentWise.API.Modules.Maintenance.Interfaces.IMaintenanceRequestService>(MockBehavior.Strict);
        var controller = new RentWise.API.Modules.Maintenance.Controllers.MaintenanceRequestsController(service.Object, db) {
            ControllerContext = Actor(tenantId, "Tenant"),
        };
        var result = await controller.UpdateStatus(request.Id, new RentWise.API.Modules.Maintenance.Controllers.MaintenanceRequestsController.MaintenanceStatusUpdateDto { Status = status, Notes = "Assessment status change" });
        if (valid) {
            Assert.IsType<OkObjectResult>(result);
            Assert.Equal(MaintenanceStatus.Completed, request.Status);
            var log = Assert.Single(db.RequestStatusLogs);
            Assert.Equal(MaintenanceStatus.Reported, log.OldStatus);
            Assert.Equal(MaintenanceStatus.Completed, log.NewStatus);
        } else {
            Assert.IsType<BadRequestObjectResult>(result);
            Assert.Equal(MaintenanceStatus.Reported, request.Status);
            Assert.Empty(db.RequestStatusLogs);
        }
        service.VerifyNoOtherCalls();
    }
}
