using System;
using RentWise.API.Common;

namespace RentWise.API.Modules.Agreements.Entities
{
    public class RentReminder : BaseEntity
    {
        public Guid RentalAgreementId { get; set; }
        public RentalAgreement RentalAgreement { get; set; } = null!;

        public DateTime DueDate { get; set; }
        public decimal AmountDue { get; set; }

        public bool IsPaid { get; set; }
        public bool ReminderSent { get; set; }
    }
}
