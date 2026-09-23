namespace RentWise.API.Modules.TenantMatching.DTOs
{
    public class PropertySearchDto
    {
        public int TenantProfileId { get; set; }
        public string? Location { get; set; }
        public decimal? MinBudget { get; set; }
        public decimal? MaxBudget { get; set; }
        public int? Bedrooms { get; set; }
    }
}
