using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentWise_Backend.Models.PropertyManagement;
using RentWise_Backend.Services.Interfaces;

namespace RentWise_Backend.Controllers
{
    [ApiController]
    [Route("api/properties/{propertyId}/documents")]
    [Authorize]
    public class PropertyDocumentsController : ControllerBase
    {
        private readonly IPropertyDocumentService _documentService;

        public PropertyDocumentsController(IPropertyDocumentService documentService)
        {
            _documentService = documentService;
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
        public async Task<IActionResult> CreateDocument(Guid propertyId, [FromBody] PropertyDocument document)
        {
            document.PropertyId = propertyId;
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
