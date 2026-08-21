using Microsoft.AspNetCore.Mvc;
using RentWise_Backend.Services.Interfaces;

namespace RentWise_Backend.Controllers
{
    [ApiController]
    [Route("api/tenant-preferences")]
    public class TenantPreferenceController : ControllerBase
    {
        private readonly ITenantPreferenceService
            _tenantPreferenceService;

        public TenantPreferenceController(
            ITenantPreferenceService tenantPreferenceService)
        {
            _tenantPreferenceService =
                tenantPreferenceService;
        }

        // GET: api/tenant-preferences/1
        [HttpGet("{tenantProfileId}")]
        public async Task<IActionResult> GetPreferences(
            int tenantProfileId)
        {
            var preferences =
                await _tenantPreferenceService
                    .GetSearchPreferencesAsync(
                        tenantProfileId);

            if (preferences == null)
            {
                return NotFound(new
                {
                    message = "Tenant profile not found."
                });
            }

            return Ok(preferences);
        }
    }
}