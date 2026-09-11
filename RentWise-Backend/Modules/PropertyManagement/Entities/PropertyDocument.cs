using System;
using System.ComponentModel.DataAnnotations;
using RentWise.API.Common;

namespace RentWise.API.Modules.PropertyManagement.Entities
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
