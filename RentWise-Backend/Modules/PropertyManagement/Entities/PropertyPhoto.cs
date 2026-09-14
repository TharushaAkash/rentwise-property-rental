using System;
using System.ComponentModel.DataAnnotations;
using RentWise_Backend.Models;

namespace RentWise_Backend.Models.PropertyManagement
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
