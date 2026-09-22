using System;
using System.Collections.Generic;
using RentWise.API.Common;
using RentWise.API.Modules.Users;
using RentWise.API.Modules.PropertyManagement.Entities;

namespace RentWise.API.Modules.Maintenance.Entities
{
    public class MaintenanceRequest : BaseEntity
    {
        public Guid TenantId { get; set; }
        public User Tenant { get; set; } = null!;

        public Guid PropertyId { get; set; }
        public Property Property { get; set; } = null!;

        public string Description { get; set; } = string.Empty;
        public string PhotoUrl { get; set; } = string.Empty; // Mobile camera integration

        public MaintenanceStatus Status { get; set; } = MaintenanceStatus.Reported;

        // Output from Maintenance Triage Agent
        public string AICategory { get; set; } = string.Empty;
        public string AIPriority { get; set; } = string.Empty;

        public Guid? AssignedServiceProviderId { get; set; }
        public ServiceProvider? AssignedServiceProvider { get; set; }

        public ICollection<RequestStatusLog> StatusLogs { get; set; } = new List<RequestStatusLog>();
    }
}
