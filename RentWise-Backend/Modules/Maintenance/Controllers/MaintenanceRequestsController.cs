using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentWise.API.Modules.Maintenance.Interfaces;
using RentWise.API.Modules.Maintenance.Entities;
using RentWise.API.Data;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace RentWise.API.Modules.Maintenance.Controllers
{
    public class UpdateMaintenanceStatusDto
    {
        public MaintenanceStatus Status { get; set; }
        public string? Notes { get; set; }
    }

    [Route("api/maintenance-requests")]
    [ApiController]
    [Authorize]
    public class MaintenanceRequestsController : ControllerBase
    {
        private readonly IMaintenanceRequestService _maintenanceRequestService;
        private readonly ApplicationDbContext _context;

        public MaintenanceRequestsController(IMaintenanceRequestService maintenanceRequestService, ApplicationDbContext context)
        {
            _maintenanceRequestService = maintenanceRequestService;
            _context = context;
        }

        [HttpGet("mine")]
        public async Task<IActionResult> GetMine()
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            if (!Guid.TryParse(claim, out var userId)) return Unauthorized();
            return Ok(await _context.MaintenanceRequests
                .Include(item => item.Property)
                .Where(item => item.TenantId == userId)
                .OrderByDescending(item => item.CreatedAt)
                .ToListAsync());
        }

        [HttpPut("{id:guid}/status")]
        [Authorize(Roles = "Tenant,PropertyOwner,SystemAdmin")]
        public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateMaintenanceStatusDto dto)
        {
            var request = await _context.MaintenanceRequests.FindAsync(id);
            if (request == null) return NotFound();

            var oldStatus = request.Status;
            request.Status = dto.Status;
            request.UpdatedAt = DateTime.UtcNow;

            var log = new RequestStatusLog
            {
                MaintenanceRequestId = id,
                OldStatus = oldStatus,
                NewStatus = dto.Status,
                Notes = !string.IsNullOrWhiteSpace(dto.Notes) ? dto.Notes : $"Status updated from {oldStatus} to {dto.Status}",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _context.RequestStatusLogs.Add(log);

            await _context.SaveChangesAsync();
            return Ok(new { message = "Status updated successfully", status = request.Status.ToString() });
        }

        [HttpPut("{id:guid}/solve")]
        public async Task<IActionResult> Solve(Guid id)
        {
            var request = await _context.MaintenanceRequests.FindAsync(id);
            if (request == null) return NotFound();

            var oldStatus = request.Status;
            request.Status = MaintenanceStatus.Completed;
            request.UpdatedAt = DateTime.UtcNow;

            _context.RequestStatusLogs.Add(new RequestStatusLog
            {
                MaintenanceRequestId = id,
                OldStatus = oldStatus,
                NewStatus = MaintenanceStatus.Completed,
                Notes = "Maintenance marked as completed",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpGet]
        public async Task<IActionResult> GetRequests()
        {
            var requests = await _context.MaintenanceRequests
                .Include(item => item.Property)
                .OrderByDescending(item => item.CreatedAt)
                .ToListAsync();
            return Ok(requests);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetRequest(Guid id)
        {
            var request = await _context.MaintenanceRequests
                .Include(item => item.Property)
                .Include(item => item.Tenant)
                .FirstOrDefaultAsync(item => item.Id == id);
            if (request == null) return NotFound();
            return Ok(request);
        }

        [HttpPost]
        [Authorize(Roles = "Tenant,PropertyOwner")]
        public async Task<IActionResult> CreateRequest([FromBody] MaintenanceRequest request)
        {
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            if (Guid.TryParse(claim, out var userId) && User.IsInRole("Tenant"))
            {
                request.TenantId = userId;
            }

            // Prevent EF navigation entity attachment issues
            request.Property = null!;
            request.Tenant = null!;
            request.AssignedServiceProvider = null;

            var createdRequest = await _maintenanceRequestService.CreateRequestAsync(request);

            // Log initial Reported state
            _context.RequestStatusLogs.Add(new RequestStatusLog
            {
                MaintenanceRequestId = createdRequest.Id,
                OldStatus = MaintenanceStatus.Reported,
                NewStatus = MaintenanceStatus.Reported,
                Notes = "Maintenance request submitted and logged as Reported",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetRequest), new { id = createdRequest.Id }, createdRequest);
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
        [Authorize(Roles = "PropertyOwner,SystemAdmin")]
        public async Task<IActionResult> DeleteRequest(Guid id)
        {
            await _maintenanceRequestService.DeleteRequestAsync(id);
            return NoContent();
        }
    }
}
