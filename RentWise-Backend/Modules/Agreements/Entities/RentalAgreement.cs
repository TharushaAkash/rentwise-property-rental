namespace RentWise_Backend.Models
{
    public class RentalAgreement
    {
        public int Id { get; set; }

        public int ApplicationId { get; set; }
        public int PropertyId { get; set; }
        public int TenantId { get; set; }
        public int OwnerId { get; set; }

        public decimal MonthlyRent { get; set; }

        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }

        public string Status { get; private set; } = AgreementStatuses.Drafted;

        public ICollection<Payment> Payments { get; set; } = new List<Payment>();
        public ICollection<RentReminder> RentReminders { get; set; } = new List<RentReminder>();

        internal void TransitionTo(string next)
        {
            if (!AgreementStatuses.CanTransition(Status, next))
                throw new InvalidOperationException($"Cannot transition from {Status} to {next}.");

            Status = next;
            UpdatedAt = DateTime.UtcNow;
        }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
