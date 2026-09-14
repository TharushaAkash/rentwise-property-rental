using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentWise.API.Modules.Maintenance.Entities;
using RentWise.API.Modules.Maintenance.Interfaces;
using ServiceProvider = RentWise.API.Modules.Maintenance.Entities.ServiceProvider;
//added
namespace RentWise.API.Modules.Maintenance.Controllers
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
        public async Task<IActionResult> GetProviders()
        {
            var result = await _service.GetAllProvidersAsync();
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
