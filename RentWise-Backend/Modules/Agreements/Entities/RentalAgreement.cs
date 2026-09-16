using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;
using RentWise_Backend.Models.PropertyManagement;

namespace RentWise_Backend.Models
{
    [Table("RentalAgreements")]
    public class RentalAgreement : BaseEntity
    {
        public Guid ApplicationId { get; set; }
        public Guid PropertyId { get; set; }
        public Guid TenantId { get; set; }
        public Guid OwnerId { get; set; }

        public decimal MonthlyRent { get; set; }

        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }

        public string Status { get; private set; } = AgreementStatuses.Drafted;

        public ICollection<Payment> Payments { get; set; } = new List<Payment>();
        public ICollection<RentReminder> RentReminders { get; set; } = new List<RentReminder>();

        // Navigation properties
        [ForeignKey("ApplicationId")]
        public Application Application { get; set; }

        [ForeignKey("PropertyId")]
        public Property Property { get; set; }

        [ForeignKey("TenantId")]
        public User Tenant { get; set; }

        [ForeignKey("OwnerId")]
        public User Owner { get; set; }

        internal void TransitionTo(string next)
        {
            if (!AgreementStatuses.CanTransition(Status, next))
                throw new InvalidOperationException($"Cannot transition from {Status} to {next}.");

            Status = next;
            UpdatedAt = DateTime.UtcNow;
        }
    }
}
