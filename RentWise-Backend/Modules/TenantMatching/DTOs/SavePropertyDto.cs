using System.ComponentModel.DataAnnotations;
namespace RentWise_Backend.DTOs.SavedProperty
{
    public class SavePropertyDto
    {
        [Required]
        public Guid TenantProfileId { get; set; }
        [Required]
        public Guid PropertyId { get; set; }
    }
}
