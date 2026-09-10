using System;

namespace RentWise_Backend.Models
{
    public class Payment
    {
        public Guid Id { get; set; }
        public int RentalAgreementId { get; set; }
        public RentalAgreement RentalAgreement { get; set; } = null!;
        
        public decimal Amount { get; set; }
        public DateTime PaymentDate { get; set; }
        public string Status { get; set; } = "Pending";
        public string PaymentMethod { get; set; } = string.Empty;
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
