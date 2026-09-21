using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentWise_Backend.Models.PropertyManagement;
using RentWise_Backend.Services.Interfaces;
using RentWise_Backend.Common.Interfaces;
using Microsoft.AspNetCore.Http;

namespace RentWise_Backend.Controllers
{
    [ApiController]
    [Route("api/properties/{propertyId}/documents")]
    [Authorize]
    public class PropertyDocumentsController : ControllerBase
    {
        private readonly IPropertyDocumentService _documentService;
        private readonly ISupabaseStorageService _storageService;

        public PropertyDocumentsController(IPropertyDocumentService documentService, ISupabaseStorageService storageService)
        {
            _documentService = documentService;
            _storageService = storageService;
        }

        [HttpGet]
        public async Task<IActionResult> GetDocuments(Guid propertyId)
        {
            var documents = await _documentService.GetAllDocumentsAsync(propertyId);
            return Ok(documents);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetDocument(Guid propertyId, Guid id)
        {
            var document = await _documentService.GetDocumentByIdAsync(id);
            if (document == null || document.PropertyId != propertyId) return NotFound();
            return Ok(document);
        }

        [HttpPost]
        [Authorize(Roles = "Owner")]
        public async Task<IActionResult> CreateDocument(Guid propertyId, IFormFile file, [FromForm] string documentType)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded.");

            if (string.IsNullOrEmpty(documentType))
                return BadRequest("Document type is required.");

            // Upload to Supabase Storage
            var fileName = $"{Guid.NewGuid()}_{file.FileName}";
            var bucketName = "property_docs";
            var filePath = $"{propertyId}/{fileName}";
            
            var documentUrl = await _storageService.UploadFileAsync(file, bucketName, filePath);

            var document = new PropertyDocument
            {
                PropertyId = propertyId,
                DocumentType = documentType,
                DocumentUrl = documentUrl
            };

            var createdDocument = await _documentService.CreateDocumentAsync(document);
            return CreatedAtAction(nameof(GetDocument), new { propertyId = propertyId, id = createdDocument.Id }, createdDocument);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Owner")]
        public async Task<IActionResult> UpdateDocument(Guid propertyId, Guid id, [FromBody] PropertyDocument document)
        {
            if (id != document.Id || propertyId != document.PropertyId) return BadRequest();
            await _documentService.UpdateDocumentAsync(document);
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Owner")]
        public async Task<IActionResult> DeleteDocument(Guid propertyId, Guid id)
        {
            await _documentService.DeleteDocumentAsync(id);
            return NoContent();
        }
    }
}
