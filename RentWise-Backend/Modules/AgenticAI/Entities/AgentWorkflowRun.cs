using System;
using System.Collections.Generic;
using RentWise.API.Common;

namespace RentWise.API.Modules.AgenticAI.Entities
{
    public class AgentWorkflowRun : BaseEntity
    {
        public string ObjectiveType { get; set; } = string.Empty;
        public string ObjectiveJson { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty; // Running, AwaitingApproval, Completed, Failed
        public Guid? RequestedById { get; set; }
        public Guid? ReviewerId { get; set; }
        public Guid? PropertyId { get; set; }
        public Guid? AgreementId { get; set; }
        public string StateJson { get; set; } = "{}";
        [System.ComponentModel.DataAnnotations.ConcurrencyCheck]
        public int Version { get; set; }
        
        public ICollection<AgentWorkflowStep> Steps { get; set; } = new List<AgentWorkflowStep>();
    }
}
