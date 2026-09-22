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
        
        public ICollection<AgentWorkflowStep> Steps { get; set; } = new List<AgentWorkflowStep>();
    }
}
