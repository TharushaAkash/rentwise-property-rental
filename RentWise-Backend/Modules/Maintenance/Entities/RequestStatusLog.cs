using System;
using RentWise_Backend.Models;

namespace RentWise_Backend.Modules.Maintenance.Entities
{
    public class RequestStatusLog : BaseEntity
    {
        public Guid MaintenanceRequestId { get; set; }
        public MaintenanceRequest MaintenanceRequest { get; set; } = null!;

        public MaintenanceStatus OldStatus { get; set; }
        public MaintenanceStatus NewStatus { get; set; }
        
        public string Notes { get; set; } = string.Empty;
    }
}
