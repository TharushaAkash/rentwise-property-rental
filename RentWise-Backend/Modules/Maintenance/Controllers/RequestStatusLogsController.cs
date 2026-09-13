using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentWise.API.Modules.Maintenance.Entities;
using RentWise.API.Modules.Maintenance.Interfaces;
using RentWise.API.Data;
using Microsoft.EntityFrameworkCore;

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

        [HttpGet]
        public async Task<IActionResult> GetLogs(Guid requestId)
        {
            var logs = await _context.RequestStatusLogs
                .Where(l => l.MaintenanceRequestId == requestId)
                .OrderByDescending(l => l.CreatedAt)
                .ToListAsync();
            return Ok(logs);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetLog(Guid requestId, Guid id)
        {
            var result = await _service.GetLogByIdAsync(id);
            if (result == null || result.MaintenanceRequestId != requestId) return NotFound();
            return Ok(result);
        }

        [HttpPost]
        [Authorize(Roles = "PropertyOwner,SystemAdmin,Tenant")]
        public async Task<IActionResult> CreateLog(Guid requestId, [FromBody] RequestStatusLog log)
        {
            log.MaintenanceRequestId = requestId;
            var created = await _service.CreateLogAsync(log);
            return CreatedAtAction(nameof(GetLog), new { requestId = requestId, id = created.Id }, created);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "PropertyOwner,SystemAdmin")]
        public async Task<IActionResult> UpdateLog(Guid requestId, Guid id, [FromBody] RequestStatusLog log)
        {
            if (id != log.Id || requestId != log.MaintenanceRequestId) return BadRequest();
            await _service.UpdateLogAsync(log);
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "SystemAdmin")]
        public async Task<IActionResult> DeleteLog(Guid requestId, Guid id)
        {
            await _service.DeleteLogAsync(id);
            return NoContent();
        }
    }
}
