using System;
using RentWise.API.Common;
using RentWise.API.Modules.Users;
using RentWise.API.Modules.PropertyManagement.Entities;

namespace RentWise.API.Modules.Agreements.Entities
{
    public class RentalAgreement : BaseEntity
    {
        public Guid PropertyId { get; set; }
        public Property Property { get; set; } = null!;

        public Guid TenantId { get; set; }
        public User Tenant { get; set; } = null!;

        public Guid OwnerId { get; set; }
        public User Owner { get; set; } = null!;

        public decimal AgreedMonthlyRent { get; set; }
        public decimal SecurityDeposit { get; set; }

        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }

        public AgreementStatus Status { get; set; } = AgreementStatus.Drafted;

        // Drafted by Agentic AI
        public string TermsAndConditions { get; set; } = string.Empty;
        public string AIMarketRentAssessment { get; set; } = string.Empty; // Output from Agent
    }
}
