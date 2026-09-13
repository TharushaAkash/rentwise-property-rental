using RentWise.API.Common;

namespace RentWise.API.Modules.Maintenance.Entities
{
    public class ServiceProvider : BaseEntity
    {
        public string Name { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty; // e.g., "Plumber", "Electrician"
        public string ContactNumber { get; set; } = string.Empty;
        public string ServiceArea { get; set; } = string.Empty;
    }
}
