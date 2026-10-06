using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using RentWise.API.Data;
using RentWise.API.Modules.PropertyManagement.Entities;
using RentWise.API.Modules.Agreements.Entities;

namespace RentWise.API.Modules.PropertyManagement.Controllers;

[ApiController, Authorize, Route("api/property-applications")]
public class PropertyApplicationsController(ApplicationDbContext db) : ControllerBase
{
    private Guid? Actor => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var id) ? id : null;
    private bool Admin => User.IsInRole("Admin") || User.IsInRole("Administrator") || User.IsInRole("SystemAdmin");
    private bool Owner => User.IsInRole("Owner") || User.IsInRole("PropertyOwner");

    [HttpGet]
    public async Task<IActionResult> GetApplications()
    {
        if (Actor == null) return Forbid();
        var query = db.PropertyApplications.AsNoTracking();
        if (!Admin) query = query.Where(a => a.TenantId == Actor || (Owner && a.Property.OwnerId == Actor));
        return Ok(await query.OrderByDescending(a => a.CreatedAt).Select(a => new {
            a.Id, a.PropertyId, ownerId = a.Property.OwnerId, propertyTitle = a.Property.Title, propertyAddress = a.Property.Address,
            propertyPhotoUrl = a.Property.Photos.OrderByDescending(p => p.IsPrimary).ThenBy(p => p.CreatedAt).Select(p => p.PhotoUrl).FirstOrDefault(),
            a.TenantId, tenantName = a.Tenant.Name, tenantEmail = a.Tenant.Email,
            a.Status, a.MonthlyRent, a.DurationMonths, a.StartDate, a.EndDate, a.Message, a.CreatedAt, a.UpdatedAt
        }).ToListAsync());
    }

    [HttpPost, Authorize(Roles = "Tenant")]
    public async Task<IActionResult> CreateApplication(StartPropertyApplication request)
    {
        if (Actor == null || !User.IsInRole("Tenant")) return Forbid();
        if (request.PropertyId == Guid.Empty || request.DurationMonths is < 1 or > 60 ||
            request.StartDate.Date < DateTime.UtcNow.Date || request.StartDate.Date > DateTime.UtcNow.Date.AddYears(5) ||
            request.Message.Length > 4000)
            return BadRequest(new { message = "Choose a valid property, future start date and lease duration of 1 to 60 months." });
        var start = DateTime.SpecifyKind(request.StartDate.Date, DateTimeKind.Utc);
        var end = start.AddMonths(request.DurationMonths);
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        try
        {
            var property = await db.Properties.SingleOrDefaultAsync(p => p.Id == request.PropertyId);
            if (property == null) return NotFound();
            if (property.Status != PropertyStatus.Active || !await db.VerificationRecords.AnyAsync(v => v.PropertyId == property.Id && v.Comments.StartsWith("[LISTING_FEE_PAID:")) || property.OwnerId == Actor || property.MonthlyRent <= 0)
                return Conflict(new { message = "This listing is not available for booking." });
            if (!await db.Users.AnyAsync(u => u.Id == Actor)) return Forbid();
            if (await db.PropertyApplications.AnyAsync(a => a.PropertyId == property.Id && (a.Status == "Submitted" || a.Status == "Accepted")) ||
                await db.RentalAgreements.AnyAsync(a => a.PropertyId == property.Id && a.Status != AgreementStatus.Ended && a.StartDate < end && a.EndDate > start))
                return Conflict(new { message = "This property already has a booking or lease for this period." });
            var application = new PropertyApplication {
                PropertyId = property.Id, TenantId = Actor.Value, MonthlyRent = property.MonthlyRent,
                DurationMonths = request.DurationMonths, StartDate = start, EndDate = end, Message = request.Message.Trim()
            };
            db.PropertyApplications.Add(application);
            await db.SaveChangesAsync();
            await tx.CommitAsync();
            return Ok(new { application.Id, application.PropertyId, application.TenantId, application.Status,
                application.MonthlyRent, application.DurationMonths, application.StartDate, application.EndDate,
                application.Message, application.CreatedAt, application.UpdatedAt });
        }
        catch (DbUpdateException) { return Conflict(new { message = "The listing changed while booking. Refresh before retrying." }); }
        catch (Exception ex) when (IsSerializationFailure(ex)) { return Conflict(new { message = "Another booking changed this listing. Refresh before retrying." }); }
    }

    private static bool IsSerializationFailure(Exception exception)
    {
        // Npgsql's execution strategy can wrap a serialization failure in
        // InvalidOperationException, with DbUpdateException nested inside it.
        for (Exception? current = exception; current != null; current = current.InnerException)
            if (current is PostgresException { SqlState: PostgresErrorCodes.SerializationFailure })
                return true;
        return false;
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin,Administrator,SystemAdmin")]
    public async Task<IActionResult> DeleteRequest(Guid id)
    {
        if (!Admin) return Forbid();
        var application = await db.PropertyApplications.FindAsync(id);
        if (application == null) return NotFound();
        if (application.Status == "Accepted")
            return Conflict(new { message = "An accepted request cannot be deleted. Manage its agreement instead." });
        var deleted = await db.PropertyApplications.Where(a => a.Id == id && a.Status != "Accepted").ExecuteDeleteAsync();
        if (deleted != 1) return Conflict(new { message = "The request changed. Refresh before deleting." });
        return NoContent();
    }

    [HttpPost("{id:guid}/confirm")]
    public Task<IActionResult> ConfirmApplication(Guid id) => Decide(id, "Accepted");
    [HttpPost("{id:guid}/reject")]
    public Task<IActionResult> RejectApplication(Guid id) => Decide(id, "Rejected");

    private async Task<IActionResult> Decide(Guid id, string status)
    {
        if (Actor == null || (!Admin && !Owner)) return Forbid();
        var query = db.PropertyApplications.Where(a => a.Id == id);
        if (!Admin) query = query.Where(a => a.Property.OwnerId == Actor);
        var app = await query.AsNoTracking().SingleOrDefaultAsync();
        if (app == null) return NotFound();
        if (app.Status == status) return Ok(new { success = true, id, status });
        if (app.Status != "Submitted") return Conflict(new { message = "This booking has already been reviewed." });
        if (status == "Accepted") query = query.Where(a => a.Property.Status == PropertyStatus.Active && a.Property.VerificationRecords.Any(v => v.Comments.StartsWith("[LISTING_FEE_PAID:")) &&
            !db.RentalAgreements.Any(r => r.PropertyId == a.PropertyId && r.Status != AgreementStatus.Ended && r.StartDate < a.EndDate && r.EndDate > a.StartDate));
        var changed = await query.Where(a => a.Status == "Submitted").ExecuteUpdateAsync(setters => setters
            .SetProperty(a => a.Status, status).SetProperty(a => a.UpdatedAt, DateTime.UtcNow));
        if (changed != 1) return Conflict(new { message = "This booking or listing changed. Refresh before retrying." });
        return Ok(new { success = true, id, status });
    }
}

public class StartPropertyApplication
{
    public Guid PropertyId { get; set; }
    [Range(1, 60)] public int DurationMonths { get; set; }
    public DateTime StartDate { get; set; }
    [MaxLength(4000)] public string Message { get; set; } = "";
}
