using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using RentWise.API.Common;
using RentWise.API.Modules.Users;

namespace RentWise.API.Modules.PropertyManagement.Entities
{
    public class Property : BaseEntity
    {
        public Guid OwnerId { get; set; }
        public User Owner { get; set; } = null!;

        [Required]
        public string Title { get; set; } = string.Empty;

        [Required]
        public string Description { get; set; } = string.Empty;

        [Required]
        public string Address { get; set; } = string.Empty;

        public decimal MonthlyRent { get; set; }

        public int Bedrooms { get; set; }
        public int Bathrooms { get; set; }
        
        public string Facilities { get; set; } = string.Empty; // Comma separated for simplicity

        public PropertyStatus Status { get; set; } = PropertyStatus.PendingVerification;

        public ICollection<PropertyPhoto> Photos { get; set; } = new List<PropertyPhoto>();
        public ICollection<PropertyDocument> Documents { get; set; } = new List<PropertyDocument>();
        public ICollection<VerificationRecord> VerificationRecords { get; set; } = new List<VerificationRecord>();
    }
}
