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
        public async Task<IActionResult> GetProfile(int userId)
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
            int userId,
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
    }
}