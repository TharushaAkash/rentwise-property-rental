using System;
using RentWise_Backend.Models;

namespace RentWise_Backend.Models.PropertyManagement
{
    public class VerificationRecord : BaseEntity
    {
        public Guid PropertyId { get; set; }
        [System.Text.Json.Serialization.JsonIgnore]
        public Property Property { get; set; } = null!;

        public Guid? AdminId { get; set; }
        public User? Admin { get; set; }

        public bool IsApproved { get; set; }
        public string Comments { get; set; } = string.Empty;
        
        // Output from the Property Verification Agent
        public string AgentReport { get; set; } = string.Empty;
    }
}
