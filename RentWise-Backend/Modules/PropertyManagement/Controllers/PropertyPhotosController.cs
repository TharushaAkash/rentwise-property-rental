using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentWise_Backend.Models.PropertyManagement;
using RentWise.API.Modules.PropertyManagement.Interfaces;
using RentWise_Backend.Common.Interfaces;
using Microsoft.AspNetCore.Http;

namespace RentWise.API.Modules.PropertyManagement.Controllers
{
    [ApiController]
    [Route("api/properties/{propertyId}/photos")]
    [Authorize]
    public class PropertyPhotosController : ControllerBase
    {
        private readonly IPropertyPhotoService _photoService;
        private readonly ISupabaseStorageService _storageService;

        public PropertyPhotosController(IPropertyPhotoService photoService, ISupabaseStorageService storageService)
        {
            _photoService = photoService;
            _storageService = storageService;
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
        public async Task<IActionResult> CreatePhoto(Guid propertyId, IFormFile file, [FromForm] bool isPrimary = false)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded.");

            // Upload to Supabase Storage
            var fileName = $"{Guid.NewGuid()}_{file.FileName}";
            var bucketName = "Properties"; // The user specified this bucket name
            var filePath = $"property-photos/{propertyId}/{fileName}";
            
            var photoUrl = await _storageService.UploadFileAsync(file, bucketName, filePath);

            var photo = new PropertyPhoto
            {
                PropertyId = propertyId,
                PhotoUrl = photoUrl,
                IsPrimary = isPrimary
            };

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
