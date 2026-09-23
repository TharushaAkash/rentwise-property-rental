using System.ComponentModel.DataAnnotations;

namespace RentWise.API.Modules.TenantMatching.DTOs
{
    public class CreateApplicationDto
    {
        [Required]
        [Range(1, int.MaxValue,
            ErrorMessage = "Tenant Profile ID must be greater than 0.")]
        public int TenantProfileId { get; set; }

        [Required]
        [Range(1, int.MaxValue,
            ErrorMessage = "Property ID must be greater than 0.")]
        public int PropertyId { get; set; }
    }
}
