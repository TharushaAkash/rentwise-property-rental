using System;
using RentWise_Backend.Common;

namespace RentWise_Backend.Models
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
