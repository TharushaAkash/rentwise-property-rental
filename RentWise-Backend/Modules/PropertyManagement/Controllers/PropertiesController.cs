using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentWise_Backend.Models.PropertyManagement;
using RentWise_Backend.Services.Interfaces;
using System.Linq;

namespace RentWise_Backend.Controllers
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

        [HttpGet("owner/{ownerId}")]
        public async Task<IActionResult> GetPropertiesByOwner(Guid ownerId)
        {
            var properties = await _propertyService.GetPropertiesByOwnerIdAsync(ownerId);
            return Ok(properties);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetProperty(Guid id)
        {
            var property = await _propertyService.GetPropertyByIdAsync(id);
            if (property == null) return NotFound();
            return Ok(property);
        }

        [HttpGet("check-duplicate")]
        public async Task<IActionResult> CheckDuplicate([FromQuery] string address)
        {
            if (string.IsNullOrWhiteSpace(address))
                return BadRequest("Address is required.");

            var allProperties = await _propertyService.GetAllPropertiesAsync();
            var duplicate = allProperties.FirstOrDefault(p => p.Address.Equals(address, StringComparison.OrdinalIgnoreCase));
            
            if (duplicate != null)
            {
                return Ok(new { exists = true, propertyId = duplicate.Id, status = duplicate.Status.ToString() });
            }
            
            return Ok(new { exists = false });
        }

        [HttpGet("search")]
        [AllowAnonymous]
        public async Task<IActionResult> SearchProperties([FromQuery] decimal? maxBudget, [FromQuery] string? location, [FromQuery] int? minBedrooms)
        {
            var properties = await _propertyService.GetAllPropertiesAsync();
            var query = properties.AsQueryable();

            if (maxBudget.HasValue)
            {
                query = query.Where(p => p.MonthlyRent <= maxBudget.Value);
            }

            if (!string.IsNullOrWhiteSpace(location))
            {
                // Simple substring match for the search
                query = query.Where(p => p.Address.Contains(location, StringComparison.OrdinalIgnoreCase) || 
                                         (p.Title != null && p.Title.Contains(location, StringComparison.OrdinalIgnoreCase)));
            }

            if (minBedrooms.HasValue)
            {
                query = query.Where(p => p.Bedrooms >= minBedrooms.Value);
            }

            // Include Active and PendingVerification properties for testing purposes
            var results = query.Where(p => 
                p.Status == RentWise_Backend.Models.PropertyManagement.PropertyStatus.Active || 
                p.Status == RentWise_Backend.Models.PropertyManagement.PropertyStatus.PendingVerification
            ).ToList();
            
            return Ok(results);
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
            
            // Explicitly load the Owner so it's included in the response
            var propertyWithOwner = await _propertyService.GetPropertyByIdAsync(createdProperty.Id);
            
            return CreatedAtAction(nameof(GetProperties), new { id = createdProperty.Id }, propertyWithOwner);
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
