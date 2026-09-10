using System.ComponentModel.DataAnnotations;

namespace RentWise_Backend.DTOs.Search
{
    public class PropertySearchDto
    {
        [Range(0, double.MaxValue)]
        public decimal? MinBudget { get; set; }

        [Range(0, double.MaxValue)]
        public decimal? MaxBudget { get; set; }

        [MaxLength(200)]
        public string? Location { get; set; }

        public int? Bedrooms { get; set; }
    }
}