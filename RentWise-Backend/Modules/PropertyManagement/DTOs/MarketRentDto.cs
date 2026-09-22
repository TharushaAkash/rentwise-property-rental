namespace RentWise_Backend.Modules.PropertyManagement.DTOs
{
    public class MarketRentDto
    {
        public decimal AverageRent { get; set; }
        public decimal MinRent { get; set; }
        public decimal MaxRent { get; set; }
        public int PropertyCount { get; set; }
    }
}
