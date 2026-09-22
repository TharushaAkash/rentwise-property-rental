using System;
using RentWise.API.Common;

namespace RentWise.API.Modules.Agreements.Entities
{
    public class Payment : BaseEntity
    {
        public Guid RentalAgreementId { get; set; }
        public RentalAgreement RentalAgreement { get; set; } = null!;

        public decimal Amount { get; set; }
        public DateTime PaymentDate { get; set; }
        
        public string PaymentReference { get; set; } = string.Empty;
        public bool IsSuccessful { get; set; }
    }
}
