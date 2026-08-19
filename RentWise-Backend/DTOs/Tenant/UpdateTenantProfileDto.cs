using System.ComponentModel.DataAnnotations;

namespace RentWise_Backend.DTOs.Tenant
{
    public class UpdateTenantProfileDto
    {
        [Range(0, double.MaxValue)]
        public decimal? PreferredBudgetMin { get; set; }

        [Range(0, double.MaxValue)]
        public decimal? PreferredBudgetMax { get; set; }

        [MaxLength(200)]
        public string? PreferredLocationText { get; set; }

        [MaxLength(100)]
        public string? Occupation { get; set; }
    }
}