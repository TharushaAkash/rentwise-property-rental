using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using RentWise.API.Modules.PropertyManagement.Entities;
using RentWise.API.Modules.PropertyManagement.Interfaces;
using RentWise.API.Common.Interfaces;
using RentWise.API.Data;
using System.Security.Claims;

namespace RentWise.API.Modules.PropertyManagement.Controllers
{
    [ApiController]
    [Route("api/properties/{propertyId}/documents")]
    [Authorize]
    public class PropertyDocumentsController : ControllerBase
    {
        private readonly IPropertyDocumentService _documentService;
        private readonly ISupabaseStorageService _storageService;
        private readonly ApplicationDbContext _context;

        public PropertyDocumentsController(IPropertyDocumentService documentService, ISupabaseStorageService storageService, ApplicationDbContext context)
        {
            _documentService = documentService;
            _storageService = storageService;
            _context = context;
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
        [Authorize(Roles = "Owner,PropertyOwner,Admin,Administrator,SystemAdmin")]
        public async Task<IActionResult> CreateDocument(Guid propertyId, IFormFile file, [FromForm] string documentType)
        {
            var property = await _context.Properties.FindAsync(propertyId);
            if (property == null) return NotFound();
            var isAdmin = User.IsInRole("Admin") || User.IsInRole("Administrator") || User.IsInRole("SystemAdmin");
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            if (!isAdmin && (!Guid.TryParse(userId, out var ownerId) || ownerId != property.OwnerId)) return Forbid();

            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded.");

            if (string.IsNullOrEmpty(documentType))
                return BadRequest("Document type is required (e.g. Deed, UtilityBill).");

            var fileName = $"{Guid.NewGuid()}_{file.FileName}";
            var bucketName = "Properties";
            var filePath = $"property-documents/{propertyId}/{fileName}";
            
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
        [Authorize(Roles = "Owner,PropertyOwner,Admin,Administrator,SystemAdmin")]
        public async Task<IActionResult> UpdateDocument(Guid propertyId, Guid id, [FromBody] PropertyDocument document)
        {
            if (id != document.Id || propertyId != document.PropertyId) return BadRequest();
            await _documentService.UpdateDocumentAsync(document);
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Owner,PropertyOwner,Admin,Administrator,SystemAdmin")]
        public async Task<IActionResult> DeleteDocument(Guid propertyId, Guid id)
        {
            await _documentService.DeleteDocumentAsync(id);
            return NoContent();
        }
    }
}
