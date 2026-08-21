using System.ComponentModel.DataAnnotations;

namespace RentWise_Backend.DTOs.Application
{
    public class CreateApplicationDto
    {
        [Required]
        [Range(1, int.MaxValue)]
        public int TenantProfileId { get; set; }

        [Required]
        [Range(1, int.MaxValue)]
        public int PropertyId { get; set; }
    }
}