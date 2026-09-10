using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace RentWise_Backend.Models
{
    public class TenantProfile
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int UserId { get; set; }

        [Column(TypeName = "decimal(12,2)")]
        public decimal? PreferredBudgetMin { get; set; }

        [Column(TypeName = "decimal(12,2)")]
        public decimal? PreferredBudgetMax { get; set; }

        [MaxLength(200)]
        public string? PreferredLocationText { get; set; }

        [MaxLength(100)]
        public string? Occupation { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}