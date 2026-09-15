using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentWise_Backend.Models.PropertyManagement;
using RentWise.API.Modules.PropertyManagement.Interfaces;

namespace RentWise.API.Modules.PropertyManagement.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class PropertiesController : ControllerBase
    {
        private readonly IPropertyService _propertyService;

        public PropertiesController(IPropertyService propertyService)
        {
            _propertyService = propertyService;
        }

        [HttpGet]
        public async Task<IActionResult> GetProperties()
        {
            var properties = await _propertyService.GetAllPropertiesAsync();
            return Ok(properties);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetProperty(Guid id)
        {
            var property = await _propertyService.GetPropertyByIdAsync(id);
            if (property == null) return NotFound();
            return Ok(property);
        }

        [HttpPost]
        [Authorize(Roles = "PropertyOwner,Administrator")]
        public async Task<IActionResult> CreateProperty([FromBody] Property property)
        {
            var createdProperty = await _propertyService.CreatePropertyAsync(property);
            return CreatedAtAction(nameof(GetProperties), new { id = createdProperty.Id }, createdProperty);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "PropertyOwner,Admin,Administrator")]
        public async Task<IActionResult> UpdateProperty(Guid id, [FromBody] Property property)
        {
            if (id != property.Id) return BadRequest();

            var existingProperty = await _propertyService.GetPropertyByIdAsync(id);
            if (existingProperty == null) return NotFound();

            bool isAdmin = User.IsInRole("Admin") || User.IsInRole("Administrator");

            // Manually map fields to avoid EF tracking conflicts
            existingProperty.Title = property.Title;
            existingProperty.Description = property.Description;
            existingProperty.Address = property.Address;
            existingProperty.MonthlyRent = property.MonthlyRent;
            existingProperty.Bedrooms = property.Bedrooms;
            existingProperty.Bathrooms = property.Bathrooms;
            existingProperty.Facilities = property.Facilities;
            existingProperty.Sqft = property.Sqft;
            existingProperty.PropertyType = property.PropertyType;
            existingProperty.FeatureTags = property.FeatureTags;
            existingProperty.PhotoCount = property.PhotoCount;
            
            if (isAdmin)
            {
                existingProperty.Status = property.Status;
            }
            
            existingProperty.UpdatedAt = DateTime.UtcNow;

            await _propertyService.UpdatePropertyAsync(existingProperty);
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "PropertyOwner,Administrator")]
        public async Task<IActionResult> DeleteProperty(Guid id)
        {
            await _propertyService.DeletePropertyAsync(id);
            return NoContent();
        }
    }
}
