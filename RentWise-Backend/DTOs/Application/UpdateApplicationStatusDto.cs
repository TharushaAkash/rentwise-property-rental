using System.ComponentModel.DataAnnotations;

namespace RentWise_Backend.DTOs.Application
{
    public class UpdateApplicationStatusDto
    {
        [Required]
        public string Status { get; set; } = string.Empty;
    }
}