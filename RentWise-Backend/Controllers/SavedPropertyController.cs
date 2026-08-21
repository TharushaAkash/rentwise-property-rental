using Microsoft.AspNetCore.Mvc;
using RentWise_Backend.DTOs.SavedProperty;
using RentWise_Backend.Services.Interfaces;

namespace RentWise_Backend.Controllers
{
    [ApiController]
    [Route("api/saved-properties")]
    public class SavedPropertyController : ControllerBase
    {
        private readonly ISavedPropertyService _savedPropertyService;

        public SavedPropertyController(
            ISavedPropertyService savedPropertyService)
        {
            _savedPropertyService = savedPropertyService;
        }

        // GET: api/saved-properties/1
        [HttpGet("{tenantProfileId}")]
        public async Task<IActionResult> GetSavedProperties(
            int tenantProfileId)
        {
            var properties =
                await _savedPropertyService
                    .GetSavedPropertiesAsync(tenantProfileId);

            return Ok(properties);
        }

        // POST: api/saved-properties
        [HttpPost]
        public async Task<IActionResult> SaveProperty(
            SavePropertyDto dto)
        {
            try
            {
                var result =
                    await _savedPropertyService.SavePropertyAsync(
                        dto.TenantProfileId,
                        dto.PropertyId);

                return Ok(result);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new
                {
                    message = ex.Message
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new
                {
                    message = ex.Message
                });
            }
        }

        // DELETE: api/saved-properties/1/5
        [HttpDelete("{tenantProfileId}/{propertyId}")]
        public async Task<IActionResult> RemoveSavedProperty(
            int tenantProfileId,
            int propertyId)
        {
            var removed =
                await _savedPropertyService
                    .RemoveSavedPropertyAsync(
                        tenantProfileId,
                        propertyId);

            if (!removed)
            {
                return NotFound(new
                {
                    message = "Saved property not found."
                });
            }

            return Ok(new
            {
                message = "Property removed from saved properties."
            });
        }
    }
}