using System;
using System.ComponentModel.DataAnnotations;
using RentWise_Backend.Models;

namespace RentWise_Backend.Models.PropertyManagement
{
    public class PropertyDocument : BaseEntity
    {
        public Guid PropertyId { get; set; }
        public Property Property { get; set; } = null!;

        [Required]
        public string DocumentType { get; set; } = string.Empty; // e.g., "Deed", "UtilityBill"

        [Required]
        public string DocumentUrl { get; set; } = string.Empty;
    }
}
