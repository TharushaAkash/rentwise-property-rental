namespace RentWise_Backend.Models
{
    public class RentReminder
    {
        public int Id { get; set; }

        public int RentalAgreementId { get; set; }

        public DateTime DueDate { get; set; }

        public DateTime? ReminderSentAt { get; set; }

        public string Status { get; set; } = "Pending";
    }
}