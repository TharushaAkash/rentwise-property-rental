using System.ComponentModel.DataAnnotations;
namespace RentWise_Backend.DTOs.Application
{
    public class CreateApplicationDto
    {
        [Required]
        public Guid TenantProfileId { get; set; }
        [Required]
        public Guid PropertyId { get; set; }
    }
}
