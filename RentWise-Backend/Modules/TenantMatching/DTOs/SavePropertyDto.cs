using System;
using System.ComponentModel.DataAnnotations;

namespace RentWise.API.Modules.TenantMatching.DTOs
{
    public class SavePropertyDto
    {
        [Required]
        public Guid TenantProfileId { get; set; }

        [Required]
        public Guid PropertyId { get; set; }
    }
}
