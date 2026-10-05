using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using RentWise.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentWise.API.Modules.Maintenance.Entities;
using RentWise.API.Modules.Maintenance.Interfaces;

namespace RentWise.API.Modules.Maintenance.Controllers
{
    [ApiController]
    [Route("api/maintenance-requests/{requestId}/logs")]
    [Authorize]
    public class RequestStatusLogsController : ControllerBase
    {
        private readonly IRequestStatusLogService _service;
        private readonly ApplicationDbContext _context;

        public RequestStatusLogsController(IRequestStatusLogService service, ApplicationDbContext context)
        {
            _service = service;
            _context = context;
        }

        private async Task<bool> CanAccess(Guid requestId)
        {
            if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var actor)) return false;
            var admin = User.IsInRole("Admin") || User.IsInRole("Administrator") || User.IsInRole("SystemAdmin");
            return await _context.MaintenanceRequests.AnyAsync(r => r.Id == requestId &&
                (admin || r.TenantId == actor || r.Property.OwnerId == actor));
        }

        [HttpGet]
        public async Task<IActionResult> GetLogs(Guid requestId)
        {
            if (!await CanAccess(requestId)) return Forbid();
            var result = await _context.RequestStatusLogs.AsNoTracking().Where(l => l.MaintenanceRequestId == requestId).OrderBy(l => l.CreatedAt).ToListAsync();
            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetLog(Guid requestId, Guid id)
        {
            if (!await CanAccess(requestId)) return Forbid();
            var result = await _service.GetLogByIdAsync(id);
            if (result == null || result.MaintenanceRequestId != requestId) return NotFound();
            return Ok(result);
        }

        [HttpPost]
        [Authorize(Roles = "Owner,PropertyOwner,Admin,Administrator,SystemAdmin")]
        public async Task<IActionResult> CreateLog(Guid requestId, [FromBody] RequestStatusLog log)
        {
            if (!await CanAccess(requestId)) return Forbid();
            log.MaintenanceRequestId = requestId;
            var created = await _service.CreateLogAsync(log);
            return CreatedAtAction(nameof(GetLog), new { requestId = requestId, id = created.Id }, created);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Owner,PropertyOwner,Admin,Administrator,SystemAdmin")]
        public async Task<IActionResult> UpdateLog(Guid requestId, Guid id, [FromBody] RequestStatusLog log)
        {
            if (id != log.Id || requestId != log.MaintenanceRequestId) return BadRequest();
            if (!await CanAccess(requestId)) return Forbid();
            var existing = await _service.GetLogByIdAsync(id);
            if (existing == null || existing.MaintenanceRequestId != requestId) return NotFound();
            await _service.UpdateLogAsync(log);
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,Administrator,SystemAdmin")]
        public async Task<IActionResult> DeleteLog(Guid requestId, Guid id)
        {
            if (!await CanAccess(requestId)) return Forbid();
            var existing = await _service.GetLogByIdAsync(id);
            if (existing == null || existing.MaintenanceRequestId != requestId) return NotFound();
            await _service.DeleteLogAsync(id);
            return NoContent();
        }
    }
}
