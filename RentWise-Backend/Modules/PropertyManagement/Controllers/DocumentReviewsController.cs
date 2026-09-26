using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RentWise.API.Data;
using RentWise.API.Modules.PropertyManagement.Entities;

namespace RentWise.API.Modules.PropertyManagement.Controllers;

[ApiController]
[Route("api/property-document-reviews")]
[Authorize]
public class DocumentReviewsController(ApplicationDbContext context) : ControllerBase
{
    private Guid? CurrentUserId => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue("sub"), out var id) ? id : null;
    private bool IsAdmin => User.IsInRole("Admin") || User.IsInRole("Administrator") || User.IsInRole("SystemAdmin");

    [HttpGet]
    public async Task<IActionResult> GetMessages([FromQuery] Guid? propertyId = null)
    {
        if (CurrentUserId == null) return Forbid();
        var query = context.DocumentReviewRequests.AsNoTracking();
        if (!IsAdmin)
            query = query.Where(r => r.OwnerId == CurrentUserId && r.Property.OwnerId == CurrentUserId);
        if (propertyId.HasValue) query = query.Where(r => r.PropertyId == propertyId.Value);
        return Ok(await query.OrderByDescending(r => r.CreatedAt).Select(r => new
        {
            r.Id, r.PropertyId, PropertyTitle = r.Property.Title, r.Message, r.DocumentUrl,
            r.CreatedAt, r.ResubmittedAt, r.ReplacementDocumentUrl,
            Status = r.ResubmittedAt == null ? "Awaiting document" : "Resubmitted"
        }).ToListAsync());
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Administrator,SystemAdmin")]
    public async Task<IActionResult> RequestReplacement([FromBody] DocumentReviewDto dto)
    {
        if (CurrentUserId == null || !IsAdmin) return Forbid();
        if (string.IsNullOrWhiteSpace(dto.Message)) return BadRequest(new { message = "Enter a note explaining what needs to be corrected." });
        var property = await context.Properties.FindAsync(dto.PropertyId);
        if (property == null) return NotFound(new { message = "Property not found." });
        if (!string.IsNullOrEmpty(dto.DocumentUrl) && !await context.PropertyDocuments.AnyAsync(d =>
            d.PropertyId == property.Id && d.DocumentUrl == dto.DocumentUrl))
            return BadRequest(new { message = "The selected document does not belong to this property." });
        if (await context.DocumentReviewRequests.AnyAsync(r => r.PropertyId == property.Id && r.ResubmittedAt == null))
            return Conflict(new { message = "A document request is already awaiting a reply from this owner." });

        var request = new DocumentReviewRequest
        {
            PropertyId = property.Id, OwnerId = property.OwnerId, AdminId = CurrentUserId.Value,
            Message = dto.Message.Trim(), DocumentUrl = dto.DocumentUrl
        };
        context.DocumentReviewRequests.Add(request);
        if (property.Status != PropertyStatus.Suspended) property.Status = PropertyStatus.PendingVerification;
        property.UpdatedAt = DateTime.UtcNow;
        await context.SaveChangesAsync();
        return Ok(new { request.Id, message = "Document request sent to the owner's My Properties inbox." });
    }
}

public class DocumentReviewDto
{
    public Guid PropertyId { get; set; }
    [Required, StringLength(2000, MinimumLength = 1)]
    public string Message { get; set; } = string.Empty;
    public string? DocumentUrl { get; set; }
}
