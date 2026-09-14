using System.ComponentModel.DataAnnotations;
namespace RentWise_Backend.Models
{
    public class Application
    {
        [Key]
        public Guid Id { get; set; }
        [Required]
        public Guid TenantProfileId { get; set; }
        [Required]
        public Guid PropertyId { get; set; }
        [Required]
        [MaxLength(30)]
        public string Status { get; set; } = "Submitted";
        public DateTime AppliedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
