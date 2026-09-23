using System;
using RentWise.API.Common;

namespace RentWise.API.Modules.Maintenance.Entities
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
