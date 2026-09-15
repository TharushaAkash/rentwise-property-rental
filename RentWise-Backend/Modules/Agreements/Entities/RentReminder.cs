using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace RentWise_Backend.Models
{
    [Table("RentReminders")]
    public class RentReminder : BaseEntity
    {
        public Guid RentalAgreementId { get; set; }
        
        [ForeignKey("RentalAgreementId")]
        public RentalAgreement RentalAgreement { get; set; } = null!;

        public DateTime DueDate { get; set; }

        public DateTime? ReminderSentAt { get; private set; }

        public string Status { get; private set; } = RentReminderStatuses.Pending;

        internal void MarkSent(DateTime sentAt)
        {
            if (Status != RentReminderStatuses.Pending) throw new InvalidOperationException("Only pending reminders can be marked sent.");
            ReminderSentAt = sentAt;
            Status = RentReminderStatuses.Sent;
        }

        internal void Complete()
        {
            if (Status is not (RentReminderStatuses.Pending or RentReminderStatuses.Sent))
                throw new InvalidOperationException("Only unfinished reminders can be completed.");
            Status = RentReminderStatuses.Completed;
        }
    }
}
