using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentWise.API.Modules.PropertyManagement.Entities;
using RentWise.API.Modules.PropertyManagement.Interfaces;

namespace RentWise.API.Modules.PropertyManagement.Controllers
{
    [ApiController]
    [Route("api/properties/{propertyId}/verifications")]
    [Authorize]
    public class VerificationRecordsController : ControllerBase
    {
        private readonly IVerificationRecordService _recordService;

        public VerificationRecordsController(IVerificationRecordService recordService)
        {
            _recordService = recordService;
        }

        [HttpGet]
        public async Task<IActionResult> GetRecords(Guid propertyId)
        {
            var records = await _recordService.GetAllRecordsAsync(propertyId);
            return Ok(records);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetRecord(Guid propertyId, Guid id)
        {
            var record = await _recordService.GetRecordByIdAsync(id);
            if (record == null || record.PropertyId != propertyId) return NotFound();
            return Ok(record);
        }

        [HttpPost]
        [Authorize(Roles = "SystemAdmin")] // Assuming only admins verify properties
        public async Task<IActionResult> CreateRecord(Guid propertyId, [FromBody] VerificationRecord record)
        {
            record.PropertyId = propertyId;
            var createdRecord = await _recordService.CreateRecordAsync(record);
            return CreatedAtAction(nameof(GetRecord), new { propertyId = propertyId, id = createdRecord.Id }, createdRecord);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "SystemAdmin")]
        public async Task<IActionResult> UpdateRecord(Guid propertyId, Guid id, [FromBody] VerificationRecord record)
        {
            if (id != record.Id || propertyId != record.PropertyId) return BadRequest();
            await _recordService.UpdateRecordAsync(record);
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "SystemAdmin")]
        public async Task<IActionResult> DeleteRecord(Guid propertyId, Guid id)
        {
            await _recordService.DeleteRecordAsync(id);
            return NoContent();
        }
    }
}
