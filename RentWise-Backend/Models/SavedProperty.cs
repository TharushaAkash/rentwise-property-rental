using System.ComponentModel.DataAnnotations;

namespace RentWise_Backend.Models
{
    public class SavedProperty
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int TenantProfileId { get; set; }

        [Required]
        public int PropertyId { get; set; }

        public DateTime SavedAt { get; set; } = DateTime.UtcNow;
    }
}