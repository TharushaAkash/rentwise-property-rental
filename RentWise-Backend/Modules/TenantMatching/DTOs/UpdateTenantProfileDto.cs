using System.ComponentModel.DataAnnotations;

namespace RentWise.API.Modules.TenantMatching.DTOs
{
    public class UpdateTenantProfileDto
    {
        [Range(0, double.MaxValue, ErrorMessage = "Minimum budget cannot be negative.")]
        public decimal? PreferredBudgetMin { get; set; }

        [Range(0, double.MaxValue, ErrorMessage = "Maximum budget cannot be negative.")]
        public decimal? PreferredBudgetMax { get; set; }

        [MaxLength(200)]
        public string? PreferredLocationText { get; set; }

        [MaxLength(100)]
        public string? Occupation { get; set; }
    }
}
