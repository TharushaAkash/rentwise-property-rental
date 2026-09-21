using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentWise_Backend.Modules.Maintenance.Entities;
using RentWise_Backend.Modules.Maintenance.Interfaces;
using ServiceProvider = RentWise_Backend.Modules.Maintenance.Entities.ServiceProvider;

namespace RentWise_Backend.Modules.Maintenance.Controllers
{
    [ApiController]
    [Route("api/service-providers")]
    [Authorize]
    public class ServiceProvidersController : ControllerBase
    {
        private readonly IServiceProviderService _service;

        public ServiceProvidersController(IServiceProviderService service)
        {
            _service = service;
        }

        [HttpGet]
        public async Task<IActionResult> GetProviders([FromQuery] Guid? ownerId)
        {
            var result = await _service.GetAllProvidersAsync(ownerId);
            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetProvider(Guid id)
        {
            var result = await _service.GetProviderByIdAsync(id);
            if (result == null) return NotFound();
            return Ok(result);
        }

        [HttpPost]
        [Authorize(Roles = "SystemAdmin,PropertyOwner")]
        public async Task<IActionResult> CreateProvider([FromBody] ServiceProvider provider)
        {
            var created = await _service.CreateProviderAsync(provider);
            return CreatedAtAction(nameof(GetProvider), new { id = created.Id }, created);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "SystemAdmin,PropertyOwner")]
        public async Task<IActionResult> UpdateProvider(Guid id, [FromBody] ServiceProvider provider)
        {
            if (id != provider.Id) return BadRequest();
            await _service.UpdateProviderAsync(provider);
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "SystemAdmin")]
        public async Task<IActionResult> DeleteProvider(Guid id)
        {
            await _service.DeleteProviderAsync(id);
            return NoContent();
        }
    }
}
