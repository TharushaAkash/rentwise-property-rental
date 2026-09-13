using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentWise.API.Modules.PropertyManagement.Entities;
using RentWise.API.Modules.PropertyManagement.Interfaces;

namespace RentWise.API.Modules.PropertyManagement.Controllers
{
    [ApiController]
    [Route("api/properties/{propertyId}/photos")]
    [Authorize]
    public class PropertyPhotosController : ControllerBase
    {
        private readonly IPropertyPhotoService _photoService;

        public PropertyPhotosController(IPropertyPhotoService photoService)
        {
            _photoService = photoService;
        }

        [HttpGet]
        public async Task<IActionResult> GetPhotos(Guid propertyId)
        {
            var photos = await _photoService.GetAllPhotosAsync(propertyId);
            return Ok(photos);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetPhoto(Guid propertyId, Guid id)
        {
            var photo = await _photoService.GetPhotoByIdAsync(id);
            if (photo == null || photo.PropertyId != propertyId) return NotFound();
            return Ok(photo);
        }

        [HttpPost]
        [Authorize(Roles = "PropertyOwner")]
        public async Task<IActionResult> CreatePhoto(Guid propertyId, [FromBody] PropertyPhoto photo)
        {
            photo.PropertyId = propertyId;
            var createdPhoto = await _photoService.CreatePhotoAsync(photo);
            return CreatedAtAction(nameof(GetPhoto), new { propertyId = propertyId, id = createdPhoto.Id }, createdPhoto);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "PropertyOwner")]
        public async Task<IActionResult> UpdatePhoto(Guid propertyId, Guid id, [FromBody] PropertyPhoto photo)
        {
            if (id != photo.Id || propertyId != photo.PropertyId) return BadRequest();
            await _photoService.UpdatePhotoAsync(photo);
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "PropertyOwner")]
        public async Task<IActionResult> DeletePhoto(Guid propertyId, Guid id)
        {
            await _photoService.DeletePhotoAsync(id);
            return NoContent();
        }
    }
}
