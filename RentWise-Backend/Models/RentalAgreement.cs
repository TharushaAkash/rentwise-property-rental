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

        public string Status { get; set; } = "Drafted";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}