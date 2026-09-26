using System.ComponentModel.DataAnnotations;
using RentWise.API.Common;

namespace RentWise.API.Modules.PropertyManagement.Entities;

public class DocumentReviewRequest : BaseEntity
{
    public Guid PropertyId { get; set; }
    public Property Property { get; set; } = null!;
    public Guid OwnerId { get; set; }
    public Guid AdminId { get; set; }
    [MaxLength(2000)]
    public string Message { get; set; } = string.Empty;
    public string? DocumentUrl { get; set; }
    public string? ReplacementDocumentUrl { get; set; }
    public DateTime? ResubmittedAt { get; set; }
}
