using Microsoft.AspNetCore.Mvc;
using RentWise_Backend.DTOs.Application;
using RentWise_Backend.Services.Interfaces;

namespace RentWise_Backend.Controllers
{
    [ApiController]
    [Route("api/applications")]
    public class ApplicationController : ControllerBase
    {
        private readonly IApplicationService _applicationService;

        public ApplicationController(
            IApplicationService applicationService)
        {
            _applicationService = applicationService;
        }

        // POST: api/applications
        [HttpPost]
        public async Task<IActionResult> CreateApplication(
            CreateApplicationDto dto)
        {
            try
            {
                var application =
                    await _applicationService
                        .CreateApplicationAsync(dto);

                return Ok(application);
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

        // GET: api/applications/1
        [HttpGet("{id}")]
        public async Task<IActionResult> GetApplication(int id)
        {
            var application =
                await _applicationService
                    .GetApplicationByIdAsync(id);

            if (application == null)
            {
                return NotFound(new
                {
                    message = "Application not found."
                });
            }

            return Ok(application);
        }

        // GET: api/applications/tenant/1
        [HttpGet("tenant/{tenantProfileId}")]
        public async Task<IActionResult> GetTenantApplications(
            int tenantProfileId)
        {
            var applications =
                await _applicationService
                    .GetTenantApplicationsAsync(
                        tenantProfileId);

            return Ok(applications);
        }

        // PUT: api/applications/1/status
        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateStatus(
            int id,
            UpdateApplicationStatusDto dto)
        {
            try
            {
                var application =
                    await _applicationService
                        .UpdateStatusAsync(id, dto);

                if (application == null)
                {
                    return NotFound(new
                    {
                        message = "Application not found."
                    });
                }

                return Ok(application);
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