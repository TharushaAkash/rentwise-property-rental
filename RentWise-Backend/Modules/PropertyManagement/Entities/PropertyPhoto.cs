using System;
using System.ComponentModel.DataAnnotations;
using RentWise.API.Common;

namespace RentWise.API.Modules.PropertyManagement.Entities
{
    public class PropertyPhoto : BaseEntity
    {
        public Guid PropertyId { get; set; }
        public Property Property { get; set; } = null!;

        [Required]
        public string PhotoUrl { get; set; } = string.Empty;
        
        public bool IsPrimary { get; set; }
    }
}
