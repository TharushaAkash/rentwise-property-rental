using Microsoft.AspNetCore.Mvc;
using RentWise_Backend.DTOs.Tenant;
using RentWise_Backend.Services.Interfaces;
namespace RentWise_Backend.Controllers
{
    [ApiController]
    [Route("api/tenant-profile")]
    public class TenantProfileController : ControllerBase
    {
        private readonly ITenantProfileService _tenantProfileService;
        public TenantProfileController(
            ITenantProfileService tenantProfileService)
        {
            _tenantProfileService = tenantProfileService;
        }
        // GET: api/tenant-profile/1
        [HttpGet("{userId}")]
        public async Task<IActionResult> GetProfile(Guid userId)
        {
            var profile =
                await _tenantProfileService.GetByUserIdAsync(userId);
            if (profile == null)
            {
                return NotFound(new
                {
                    message = "Tenant profile not found."
                });
            }
            return Ok(profile);
        }
        // POST: api/tenant-profile
        [HttpPost]
        public async Task<IActionResult> CreateProfile(
            CreateTenantProfileDto dto)
        {
            try
            {
                var profile =
                    await _tenantProfileService.CreateAsync(dto);
                return Ok(profile);
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
        // PUT: api/tenant-profile/1
        [HttpPut("{userId}")]
        public async Task<IActionResult> UpdateProfile(
            Guid userId,
            UpdateTenantProfileDto dto)
        {
            try
            {
                var profile =
                    await _tenantProfileService.UpdateAsync(
                        userId,
                        dto
                    );
                if (profile == null)
                {
                    return NotFound(new
                    {
                        message = "Tenant profile not found."
                    });
                }
                return Ok(profile);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new
                {
                    message = ex.Message
                });
            }
        }
        // DELETE: api/tenant-profile/1
        [HttpDelete("{userId}")]
        public async Task<IActionResult> DeleteProfile(Guid userId)
        {
            var result = await _tenantProfileService.DeleteAsync(userId);
            if (!result)
            {
                return NotFound(new { message = "Tenant profile not found." });
            }
            return NoContent();
        }
    }
}
