using System.Collections.Generic;

namespace RentWise_Backend.DTOs.Search
{
    public class PropertySearchResultDto
    {
        public int PropertyId { get; set; }

        public string? Title { get; set; }

        public decimal RentAmount { get; set; }

        public string? Location { get; set; }

        public int Bedrooms { get; set; }

        public int Sqft { get; set; }
        public string? PropertyType { get; set; }
        public List<string> FeatureTags { get; set; } = new List<string>();
        public int PhotoCount { get; set; }
    }
}