using System.ComponentModel.DataAnnotations;
using RentWise.API.Common;
using RentWise.API.Modules.Users;

namespace RentWise.API.Modules.PropertyManagement.Entities;

// Separate from the legacy integer-key tenant-matching Applications table.
public class PropertyApplication : BaseEntity
{
    public Guid PropertyId { get; set; }
    public Property Property { get; set; } = null!;
    public Guid TenantId { get; set; }
    public User Tenant { get; set; } = null!;
    [MaxLength(30)] public string Status { get; set; } = "Submitted";
    public decimal MonthlyRent { get; set; }
    public int DurationMonths { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    [MaxLength(4000)] public string Message { get; set; } = "";
}
