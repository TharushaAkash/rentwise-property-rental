namespace RentWise.API.Modules.PropertyManagement.DTOs
{
    public class MarketRentDto
    {
        public string Location { get; set; } = string.Empty;
        public string PropertyType { get; set; } = string.Empty;
        public int Bedrooms { get; set; }
        public decimal AverageRent { get; set; }
        public decimal MinRent { get; set; }
        public decimal MaxRent { get; set; }
        public int SampleCount { get; set; }
    }
}
