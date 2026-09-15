using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using RentWise_Backend.Models.PropertyManagement;

namespace RentWise_Backend.Modules.PropertyManagement.DTOs
{
    public class UpdatePropertyDto
    {
        [Required]
        public string Title { get; set; } = string.Empty;

        [Required]
        public string Description { get; set; } = string.Empty;

        [Required]
        public string Address { get; set; } = string.Empty;

        public decimal MonthlyRent { get; set; }

        public int Bedrooms { get; set; }
        public int Bathrooms { get; set; }
        
        public string Facilities { get; set; } = string.Empty;

        public int Sqft { get; set; }
        public string PropertyType { get; set; } = string.Empty;
        public List<string> FeatureTags { get; set; } = new List<string>();
        public int PhotoCount { get; set; }

        public PropertyStatus? Status { get; set; } // Admins can update this
    }
}
