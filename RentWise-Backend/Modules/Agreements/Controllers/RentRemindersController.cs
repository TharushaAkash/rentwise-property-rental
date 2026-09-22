using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentWise.API.Modules.Agreements.Entities;
using RentWise.API.Modules.Agreements.Interfaces;

namespace RentWise.API.Modules.Agreements.Controllers
{
    [ApiController]
    [Route("api/agreements/{agreementId}/reminders")]
    [Authorize]
    public class RentRemindersController : ControllerBase
    {
        private readonly IRentReminderService _service;

        public RentRemindersController(IRentReminderService service)
        {
            _service = service;
        }

        [HttpGet]
        public async Task<IActionResult> GetReminders(Guid agreementId)
        {
            var result = await _service.GetAllRemindersAsync(agreementId);
            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetReminder(Guid agreementId, Guid id)
        {
            var result = await _service.GetReminderByIdAsync(id);
            if (result == null || result.RentalAgreementId != agreementId) return NotFound();
            return Ok(result);
        }

        [HttpPost]
        [Authorize(Roles = "PropertyOwner,SystemAdmin")]
        public async Task<IActionResult> CreateReminder(Guid agreementId, [FromBody] RentReminder reminder)
        {
            reminder.RentalAgreementId = agreementId;
            var created = await _service.CreateReminderAsync(reminder);
            return CreatedAtAction(nameof(GetReminder), new { agreementId = agreementId, id = created.Id }, created);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "PropertyOwner,SystemAdmin")]
        public async Task<IActionResult> UpdateReminder(Guid agreementId, Guid id, [FromBody] RentReminder reminder)
        {
            if (id != reminder.Id || agreementId != reminder.RentalAgreementId) return BadRequest();
            await _service.UpdateReminderAsync(reminder);
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "PropertyOwner,SystemAdmin")]
        public async Task<IActionResult> DeleteReminder(Guid agreementId, Guid id)
        {
            await _service.DeleteReminderAsync(id);
            return NoContent();
        }
    }
}
