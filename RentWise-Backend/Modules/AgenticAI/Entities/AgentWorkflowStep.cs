using System;
using RentWise.API.Common;

namespace RentWise.API.Modules.AgenticAI.Entities
{
    public class AgentWorkflowStep : BaseEntity
    {
        public Guid WorkflowId { get; set; }
        public AgentWorkflowRun Workflow { get; set; } = null!;

        public string AgentName { get; set; } = string.Empty;
        public string ToolCallsJson { get; set; } = string.Empty;
        public string OutputJson { get; set; } = string.Empty;
        public string ValidationResult { get; set; } = string.Empty;
    }
}
