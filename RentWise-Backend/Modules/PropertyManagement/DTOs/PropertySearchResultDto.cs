namespace RentWise_Backend.DTOs.Search
{
    public class PropertySearchResultDto
    {
        public int PropertyId { get; set; }

        public string? Title { get; set; }

        public decimal RentAmount { get; set; }

        public string? Location { get; set; }

        public int Bedrooms { get; set; }
    }
}