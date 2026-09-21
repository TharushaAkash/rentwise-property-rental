using RentWise_Backend.Models;

namespace RentWise_Backend.Modules.Maintenance.Entities
{
    public class ServiceProvider : BaseEntity
    {
        public string Name { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty; // e.g., "Plumber", "Electrician"
        public string ContactNumber { get; set; } = string.Empty;
        public string ServiceArea { get; set; } = string.Empty;
        public Guid OwnerId { get; set; }
    }
}
