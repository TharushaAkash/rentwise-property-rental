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
        [Authorize(Roles = "Owner,Admin")]
        public async Task<IActionResult> CreateProperty([FromBody] RentWise_Backend.Modules.PropertyManagement.DTOs.CreatePropertyDto dto)
        {
            var property = new Property
            {
                OwnerId = dto.OwnerId,
                Title = dto.Title,
                Description = dto.Description,
                Address = dto.Address,
                MonthlyRent = dto.MonthlyRent,
                Bedrooms = dto.Bedrooms,
                Bathrooms = dto.Bathrooms,
                Facilities = dto.Facilities,
                Sqft = dto.Sqft,
                PropertyType = dto.PropertyType,
                FeatureTags = dto.FeatureTags,
                PhotoCount = dto.PhotoCount
            };

            var createdProperty = await _propertyService.CreatePropertyAsync(property);
            return CreatedAtAction(nameof(GetProperties), new { id = createdProperty.Id }, createdProperty);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Owner,Admin")]
        public async Task<IActionResult> UpdateProperty(Guid id, [FromBody] RentWise_Backend.Modules.PropertyManagement.DTOs.UpdatePropertyDto dto)
        {
            var existingProperty = await _propertyService.GetPropertyByIdAsync(id);
            if (existingProperty == null) return NotFound();

            bool isAdmin = User.IsInRole("Admin");

            // Map fields from DTO
            existingProperty.Title = dto.Title;
            existingProperty.Description = dto.Description;
            existingProperty.Address = dto.Address;
            existingProperty.MonthlyRent = dto.MonthlyRent;
            existingProperty.Bedrooms = dto.Bedrooms;
            existingProperty.Bathrooms = dto.Bathrooms;
            existingProperty.Facilities = dto.Facilities;
            existingProperty.Sqft = dto.Sqft;
            existingProperty.PropertyType = dto.PropertyType;
            existingProperty.FeatureTags = dto.FeatureTags;
            existingProperty.PhotoCount = dto.PhotoCount;
            
            if (isAdmin && dto.Status.HasValue)
            {
                existingProperty.Status = dto.Status.Value;
            }
            
            existingProperty.UpdatedAt = DateTime.UtcNow;

            await _propertyService.UpdatePropertyAsync(existingProperty);
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Owner,Admin")]
        public async Task<IActionResult> DeleteProperty(Guid id)
        {
            await _propertyService.DeletePropertyAsync(id);
            return NoContent();
        }
    }
}
