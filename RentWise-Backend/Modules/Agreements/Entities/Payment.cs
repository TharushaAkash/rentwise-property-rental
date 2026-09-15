using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace RentWise_Backend.Models
{
    [Table("Payments")]
    public class Payment : BaseEntity
    {
        public Guid RentalAgreementId { get; set; }
        
        [ForeignKey("RentalAgreementId")]
        public RentalAgreement RentalAgreement { get; set; } = null!;
        
        public decimal Amount { get; set; }
        public DateTime PaymentDate { get; set; }
        public string Status { get; set; } = "Pending";
        public string PaymentMethod { get; set; } = string.Empty;
    }
}
