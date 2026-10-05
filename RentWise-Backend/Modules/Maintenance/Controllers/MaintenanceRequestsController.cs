using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RentWise.API.Data;
using RentWise.API.Modules.Maintenance.Entities;
using RentWise.API.Modules.Maintenance.Interfaces;

namespace RentWise.API.Modules.Maintenance.Controllers
{
    [Route("api/maintenance-requests")]
    [ApiController]
    [Authorize]
    public class MaintenanceRequestsController : ControllerBase
    {
        private readonly IMaintenanceRequestService _maintenanceRequestService;
        private readonly ApplicationDbContext _context;

        public MaintenanceRequestsController(
            IMaintenanceRequestService maintenanceRequestService,
            ApplicationDbContext context)
        {
            _maintenanceRequestService = maintenanceRequestService;
            _context = context;
        }

        private Guid? Actor => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub), out var id) ? id : null;
        private bool Admin => User.IsInRole("Admin") || User.IsInRole("Administrator") || User.IsInRole("SystemAdmin");
        private async Task<bool> CanAccess(MaintenanceRequest request) => Actor != null &&
            (Admin || request.TenantId == Actor || await _context.Properties.AnyAsync(p => p.Id == request.PropertyId && p.OwnerId == Actor));
        private async Task<bool> CanAssign(MaintenanceRequest request) => request.AssignedServiceProviderId == null ||
            await _context.ServiceProviders.AnyAsync(sp => sp.Id == request.AssignedServiceProviderId &&
                _context.Properties.Any(p => p.Id == request.PropertyId && p.OwnerId == sp.OwnerId));

        [HttpGet]
        public async Task<IActionResult> GetRequests()
        {
            if (Actor == null) return Forbid();
            var requests = await _context.MaintenanceRequests
                .Include(r => r.Property).Include(r => r.Tenant)
                .Where(r => Admin || r.TenantId == Actor || r.Property.OwnerId == Actor)
                .OrderByDescending(r => r.CreatedAt).ToListAsync();
            return Ok(requests);
        }

        [HttpGet("mine")]
        public Task<IActionResult> GetMyRequests() => GetRequests();

        [HttpGet("{id}")]
        public async Task<IActionResult> GetRequest(Guid id)
        {
            var request = await _context.MaintenanceRequests
                .Include(r => r.Property)
                    .ThenInclude(p => p.Photos)
                .Include(r => r.Property)
                    .ThenInclude(p => p.Owner)
                .Include(r => r.Tenant)
                .Include(r => r.AssignedServiceProvider)
                .Include(r => r.StatusLogs)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (request == null)
            {
                request = await _maintenanceRequestService.GetRequestByIdAsync(id);
            }
            if (request == null) return NotFound();
            if (!await CanAccess(request)) return Forbid();
            return Ok(request);
        }

        [HttpPost]
        [Authorize(Roles = "Tenant,Owner,PropertyOwner")]
        public async Task<IActionResult> CreateRequest([FromBody] MaintenanceRequest request)
        {
            if (Actor == null) return Forbid();
            var property = await _context.Properties.FindAsync(request.PropertyId);
            if (property == null) return NotFound();
            if (!Admin && property.OwnerId != Actor &&
                !await _context.RentalAgreements.AnyAsync(a => a.PropertyId == property.Id && a.TenantId == Actor) &&
                !await _context.PropertyApplications.AnyAsync(a => a.PropertyId == property.Id && a.TenantId == Actor &&
                    (a.Status == "Submitted" || a.Status == "Accepted"))) return Forbid();
            request.TenantId = Actor.Value;
            if (!await CanAssign(request)) return BadRequest(new { message = "Select a service provider belonging to this property's owner." });

            if (request.CreatedAt == default)
            {
                request.CreatedAt = DateTime.UtcNow;
            }
            request.UpdatedAt = DateTime.UtcNow;

            var createdRequest = await _maintenanceRequestService.CreateRequestAsync(request);

            try
            {
                var initialLog = new RequestStatusLog
                {
                    Id = Guid.NewGuid(),
                    MaintenanceRequestId = createdRequest.Id,
                    OldStatus = MaintenanceStatus.Reported,
                    NewStatus = createdRequest.Status,
                    Notes = "Maintenance request submitted by tenant.",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                await _context.RequestStatusLogs.AddAsync(initialLog);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[MaintenanceLog Warning] {ex.Message}");
            }

            return CreatedAtAction(nameof(GetRequest), new { id = createdRequest.Id }, createdRequest);
        }

        public class MaintenanceStatusUpdateDto
        {
            public string Status { get; set; } = string.Empty;
            public string Notes { get; set; } = string.Empty;
        }

        [HttpPut("{id}/status")]
        [Authorize(Roles = "Tenant,Owner,PropertyOwner,Admin,Administrator,SystemAdmin")]
        public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] MaintenanceStatusUpdateDto dto)
        {
            var request = await _context.MaintenanceRequests.FindAsync(id);
            if (request == null) return NotFound();
            if (!await CanAccess(request)) return Forbid();

            var oldStatus = request.Status;
            if (!Enum.TryParse<MaintenanceStatus>(dto.Status, true, out var parsedStatus) || !Enum.IsDefined(parsedStatus))
                return BadRequest(new { message = "Choose a valid maintenance status." });
            request.Status = parsedStatus;

            request.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            try
            {
                var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
                             ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                             ?? User.FindFirst("sub")?.Value;
                Guid.TryParse(userIdStr, out var currentUserId);

                var log = new RequestStatusLog
                {
                    Id = Guid.NewGuid(),
                    MaintenanceRequestId = id,
                    OldStatus = oldStatus,
                    NewStatus = request.Status,
                    Notes = string.IsNullOrWhiteSpace(dto.Notes) ? $"Status changed to {request.Status}" : dto.Notes,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                await _context.RequestStatusLogs.AddAsync(log);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[StatusLog Warning] {ex.Message}");
            }

            return Ok(request);
        }

        public class MaintenancePhotoUpdateDto
        {
            public string PhotoUrl { get; set; } = string.Empty;
        }

        [HttpPut("{id}/photo")]
        [Authorize]
        public async Task<IActionResult> UpdatePhoto(Guid id, [FromBody] MaintenancePhotoUpdateDto dto)
        {
            var request = await _context.MaintenanceRequests.FindAsync(id);
            if (request == null) return NotFound();
            if (!await CanAccess(request)) return Forbid();

            request.PhotoUrl = dto.PhotoUrl ?? string.Empty;
            request.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(request);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Tenant,Owner,PropertyOwner,Admin,Administrator,SystemAdmin")]
        public async Task<IActionResult> UpdateRequest(Guid id, [FromBody] MaintenanceRequest request)
        {
            if (id != request.Id) return BadRequest();
            var existing = await _context.MaintenanceRequests.AsNoTracking().FirstOrDefaultAsync(r => r.Id == id);
            if (existing == null) return NotFound();
            if (!await CanAccess(existing)) return Forbid();
            request.TenantId = existing.TenantId;
            request.PropertyId = existing.PropertyId;
            if (!await CanAssign(request)) return BadRequest(new { message = "Select a service provider belonging to this property's owner." });
            await _maintenanceRequestService.UpdateRequestAsync(request);
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize]
        public async Task<IActionResult> DeleteRequest(Guid id)
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
                         ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                         ?? User.FindFirst("sub")?.Value;
            Guid.TryParse(userIdStr, out var currentUserId);

            var userRole = User.FindFirstValue(ClaimTypes.Role) ?? "";
            bool isAdmin = userRole == "Administrator" || userRole == "Admin" || userRole == "SystemAdmin";

            var request = await _context.MaintenanceRequests
                .Include(r => r.Property)
                .Include(r => r.StatusLogs)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (request == null)
            {
                return NotFound(new { message = "Maintenance request not found" });
            }

            if (Actor == null) return Forbid();

            // Permission check: Submitter (Tenant), Property Owner, or Admin
            bool isSubmitter = Actor != null && request.TenantId == currentUserId;
            bool isPropertyOwner = request.Property != null && request.Property.OwnerId == currentUserId;

            if (!isAdmin && !isSubmitter && !isPropertyOwner)
            {
                return Forbid();
            }

            // Clean up related status logs
            if (request.StatusLogs != null && request.StatusLogs.Any())
            {
                _context.RequestStatusLogs.RemoveRange(request.StatusLogs);
            }

            _context.MaintenanceRequests.Remove(request);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
