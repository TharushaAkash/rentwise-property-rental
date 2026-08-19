using System.ComponentModel.DataAnnotations;

namespace RentWise_Backend.Models
{
    public class Application
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int TenantProfileId { get; set; }

        [Required]
        public int PropertyId { get; set; }

        [Required]
        [MaxLength(30)]
        public string Status { get; set; } = "Submitted";

        public DateTime AppliedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}