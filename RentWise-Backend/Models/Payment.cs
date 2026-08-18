namespace RentWise_Backend.Models
{
    public class Payment
    {
        public int Id { get; set; }

        public int RentalAgreementId { get; set; }

        public decimal Amount { get; set; }

        public DateTime PaymentDate { get; set; } = DateTime.UtcNow;

        public string Status { get; set; } = "Pending";

        public string PaymentMethod { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}