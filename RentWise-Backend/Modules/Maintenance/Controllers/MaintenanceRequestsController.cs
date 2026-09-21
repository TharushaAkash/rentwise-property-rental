using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RentWise_Backend.Data;
using RentWise_Backend.Modules.Maintenance.Entities;
using RentWise_Backend.Modules.Maintenance.Interfaces;

namespace RentWise_Backend.Modules.Maintenance.Controllers
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

        [HttpGet]
        public async Task<IActionResult> GetRequests()
        {
            var requests = await _context.MaintenanceRequests
                .Include(r => r.Property)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();
            return Ok(requests);
        }

        [HttpGet("mine")]
        public async Task<IActionResult> GetMyRequests()
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
                         ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                         ?? User.FindFirst("sub")?.Value;

            if (!Guid.TryParse(userIdStr, out var userId))
            {
                var all = await _context.MaintenanceRequests
                    .Include(r => r.Property)
                    .OrderByDescending(r => r.CreatedAt)
                    .ToListAsync();
                return Ok(all);
            }

            var requests = await _context.MaintenanceRequests
                .Include(r => r.Property)
                .Where(r => r.TenantId == userId || (r.Property != null && r.Property.OwnerId == userId) || r.TenantId == Guid.Empty)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();

            if (!requests.Any())
            {
                requests = await _context.MaintenanceRequests
                    .Include(r => r.Property)
                    .OrderByDescending(r => r.CreatedAt)
                    .ToListAsync();
            }

            return Ok(requests);
        }

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
            return Ok(request);
        }

        [HttpPost]
        [Authorize(Roles = "Tenant,PropertyOwner")]
        public async Task<IActionResult> CreateRequest([FromBody] MaintenanceRequest request)
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
                         ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                         ?? User.FindFirst("sub")?.Value;

            if (Guid.TryParse(userIdStr, out var userId))
            {
                if (request.TenantId == Guid.Empty)
                {
                    request.TenantId = userId;
                }
            }

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
        [Authorize(Roles = "Tenant,PropertyOwner,SystemAdmin")]
        public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] MaintenanceStatusUpdateDto dto)
        {
            var request = await _context.MaintenanceRequests.FindAsync(id);
            if (request == null) return NotFound();

            var oldStatus = request.Status;
            if (Enum.TryParse<MaintenanceStatus>(dto.Status, true, out var parsedStatus))
            {
                request.Status = parsedStatus;
            }

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

            request.PhotoUrl = dto.PhotoUrl ?? string.Empty;
            request.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(request);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Tenant,PropertyOwner,SystemAdmin")]
        public async Task<IActionResult> UpdateRequest(Guid id, [FromBody] MaintenanceRequest request)
        {
            if (id != request.Id) return BadRequest();
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

            // Permission check: Submitter (Tenant), Property Owner, or Admin
            bool isSubmitter = request.TenantId == currentUserId || request.TenantId == Guid.Empty;
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
