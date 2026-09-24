using System;
using System.ComponentModel.DataAnnotations;

namespace RentWise.API.Modules.TenantMatching.Entities
{
    public class SavedProperty
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public Guid TenantProfileId { get; set; }

        [Required]
        public Guid PropertyId { get; set; }

        public DateTime SavedAt { get; set; } = DateTime.UtcNow;
    }
}
