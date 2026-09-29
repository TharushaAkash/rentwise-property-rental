using System;
using RentWise.API.Common;

namespace RentWise.API.Modules.Agreements.Entities
{
    public class Payment : BaseEntity
    {
        public Guid RentalAgreementId { get; set; }
        public RentalAgreement RentalAgreement { get; set; } = null!;

        public string Purpose { get; set; } = "Unspecified";

        public decimal Amount { get; set; }
        public DateTime PaymentDate { get; set; }
        
        public string PaymentReference { get; set; } = string.Empty;
        public bool IsSuccessful { get; set; }

        [System.ComponentModel.DataAnnotations.Schema.NotMapped]
        public string PaymentMethod { get; set; } = "Not specified";

        [System.ComponentModel.DataAnnotations.Schema.NotMapped]
        public bool? ConfirmationEmailSent { get; set; }
    }
}
