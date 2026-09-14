using System.ComponentModel.DataAnnotations;
namespace RentWise_Backend.Models
{
    public class SavedProperty
    {
        [Key]
        public Guid Id { get; set; }
        [Required]
        public Guid TenantProfileId { get; set; }
        [Required]
        public Guid PropertyId { get; set; }
        public DateTime SavedAt { get; set; } = DateTime.UtcNow;
    }
}
