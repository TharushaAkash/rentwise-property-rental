using System.ComponentModel.DataAnnotations;

namespace RentWise.API.Modules.TenantMatching.DTOs
{
    public class UpdateApplicationStatusDto
    {
        [Required]
        public string Status { get; set; } = string.Empty;
    }
}
