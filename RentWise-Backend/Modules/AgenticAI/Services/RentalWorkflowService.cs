using System.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RentWise.API.Data;
using RentWise.API.Modules.AgenticAI.Entities;
using RentWise.API.Modules.Agreements.Entities;
using RentWise.API.Modules.PropertyManagement.Entities;

namespace RentWise.API.Modules.AgenticAI.Services;

public class RentalWorkflowService(ApplicationDbContext db, IRentalWorkflowAgentClient agents)
{
    public async Task<AgentWorkflowRun> Start(Guid userId, StartRentalWorkflow request)
    {
        RentalWorkflowRules.ValidateRequest(request);
        request.StartDate = DateTime.SpecifyKind(request.StartDate.Date, DateTimeKind.Utc);
        request.EndDate = DateTime.SpecifyKind(request.EndDate.Date, DateTimeKind.Utc);
        var state = new RentalWorkflowState { Request = request };
        var run = new AgentWorkflowRun
        {
            RequestedById = userId, ObjectiveType = "RentalPreparation", Status = "Ready",
            ObjectiveJson = RentalWorkflowRules.Serialize(request), StateJson = RentalWorkflowRules.Serialize(state)
        };
        run.Steps.Add(new AgentWorkflowStep
        {
            AgentName = "Coordinator", Sequence = 0, Attempt = 1,
            InputJson = run.ObjectiveJson,
            OutputJson = RentalWorkflowRules.Serialize(new
            {
                objective = request.Objective,
                plan = state.Plan.Select((role, i) => new { step = i + 1, agent = role, tool = RentalWorkflowRules.Tools[role], dependsOn = i == 0 ? "objective" : state.Plan[i - 1] }),
                approvalAction = "Create a draft rental agreement; no activation, payment or dispatch"
            }),
            ValidationResult = "Passed: budget and dates validated; tools and delegation restricted to the rental preparation plan."
        });
        db.AgentWorkflowRuns.Add(run);
        await db.SaveChangesAsync();
        return run;
    }

    public async Task<bool> Available(Guid propertyId, StartRentalWorkflow request)
        => !await db.RentalAgreements.AnyAsync(a => a.PropertyId == propertyId && a.Status != AgreementStatus.Ended
            && a.StartDate < request.EndDate && a.EndDate > request.StartDate);

    private async Task<Property> Selected(AgentWorkflowRun run, RentalWorkflowState state)
    {
        var property = await db.Properties.AsNoTracking().SingleOrDefaultAsync(p => p.Id == run.PropertyId);
        if (property == null || property.Status != PropertyStatus.Active || !await db.VerificationRecords.AnyAsync(v => v.PropertyId == property.Id && v.Comments.StartsWith("[LISTING_FEE_PAID:")) || property.MonthlyRent <= 0
            || property.MonthlyRent > state.Request.MaxMonthlyRent || property.OwnerId == run.RequestedById
            || string.IsNullOrWhiteSpace(property.Address) || !await Available(property.Id, state.Request))
            throw new InvalidOperationException("The selected property is unavailable, unverified, or outside the approved budget. Start a new workflow.");
        return property;
    }

    private static object Snapshot(Property p) => new
    {
        p.Id, p.Title, p.Address, p.MonthlyRent, p.Bedrooms, p.Bathrooms, p.PropertyType, p.Facilities,
        status = p.Status.ToString()
    };

    public async Task Advance(AgentWorkflowRun run)
    {
        var state = RentalWorkflowRules.Read(run.StateJson);
        if (run.Status == "Executing" && run.UpdatedAt > DateTime.UtcNow.AddMinutes(-3))
            throw new InvalidOperationException("This step is still running. Refresh shortly.");
        if (run.Status is not ("Ready" or "Failed" or "Executing"))
            throw new InvalidOperationException("This workflow cannot run another step.");
        if (state.Attempts >= 3)
        {
            if (run.Status == "Executing")
            {
                state.Error = "Execution was interrupted and the retry limit was reached. Start a new workflow.";
                var pending = await db.AgentWorkflowSteps.Where(s => s.WorkflowId == run.Id && s.ValidationResult == "Running").ToListAsync();
                foreach (var item in pending) { item.ValidationResult = "Failed: " + state.Error; item.UpdatedAt = DateTime.UtcNow; }
                run.Status = "Failed";
                run.Version++;
                run.UpdatedAt = DateTime.UtcNow;
                run.StateJson = RentalWorkflowRules.Serialize(state);
                await db.SaveChangesAsync();
                return;
            }
            throw new InvalidOperationException("Retry limit reached. Start a new workflow.");
        }
        var role = RentalWorkflowRules.Plan.FirstOrDefault(r => !state.Outputs.ContainsKey(r))
            ?? throw new InvalidOperationException("All steps are already complete.");
        // Claim a step durably before calling an external service. Version prevents concurrent execution.
        if (run.Status == "Executing")
        {
            var interrupted = await db.AgentWorkflowSteps.Where(s => s.WorkflowId == run.Id && s.ValidationResult == "Running").ToListAsync();
            foreach (var item in interrupted) { item.ValidationResult = "Interrupted: execution lease expired; safe to retry read-only agent."; item.UpdatedAt = DateTime.UtcNow; }
        }
        state.Attempts++;
        state.Error = null;
        run.Status = "Executing";
        run.UpdatedAt = DateTime.UtcNow;
        run.Version++;
        run.StateJson = RentalWorkflowRules.Serialize(state);
        var step = new AgentWorkflowStep
        {
            WorkflowId = run.Id, AgentName = role, Sequence = Array.IndexOf(RentalWorkflowRules.Plan, role) + 1,
            Attempt = state.Attempts, ValidationResult = "Running"
        };
        db.AgentWorkflowSteps.Add(step);
        await db.SaveChangesAsync();
        try
        {
            RentalWorkflowRules.ValidateRequest(state.Request);
            Property? property = null;
            object[] candidates = [];
            if (role == "MatchingLocation")
            {
                var available = await db.Properties.AsNoTracking().Where(p => p.Status == PropertyStatus.Active && p.VerificationRecords.Any(v => v.Comments.StartsWith("[LISTING_FEE_PAID:"))
                    && p.MonthlyRent > 0 && p.MonthlyRent <= state.Request.MaxMonthlyRent && p.OwnerId != run.RequestedById
                    && !db.RentalAgreements.Any(a => a.PropertyId == p.Id && a.Status != AgreementStatus.Ended
                        && a.StartDate < state.Request.EndDate && a.EndDate > state.Request.StartDate))
                    .OrderBy(p => p.MonthlyRent).ThenBy(p => p.Id).Take(50).ToListAsync();
                candidates = available.Select(Snapshot).ToArray();
                if (candidates.Length == 0) throw new InvalidOperationException("No available properties match this budget and lease period.");
            }
            else property = await Selected(run, state);
            var input = new
            {
                workflowId = run.Id, objective = state.Request.Objective, request = state.Request,
                outputs = state.Outputs, candidates, property = property == null ? null : Snapshot(property)
            };
            step.InputJson = RentalWorkflowRules.Serialize(input);
            await db.SaveChangesAsync();
            var result = await agents.Execute(role, input);
            if (!result.TryGetProperty("output", out var output) || !result.TryGetProperty("toolCalls", out var calls)
                || calls.ValueKind != JsonValueKind.Array || calls.GetArrayLength() != 1
                || RentalWorkflowRules.RequiredText(calls[0], "name") != RentalWorkflowRules.Tools[role]
                || !calls[0].TryGetProperty("arguments", out var args) || args.ValueKind != JsonValueKind.Object
                || args.EnumerateObject().Any() || !calls[0].TryGetProperty("result", out _))
                throw new InvalidOperationException("Agent did not return its required allow-listed tool evidence.");
            step.ToolCallsJson = calls.GetRawText();
            RentalWorkflowRules.ValidateOutput(role, output, run.PropertyId, property?.MonthlyRent);
            if (role == "MatchingLocation")
            {
                var id = Guid.Parse(output.GetProperty("propertyId").GetString()!);
                using var inputDoc = JsonDocument.Parse(step.InputJson);
                if (!inputDoc.RootElement.GetProperty("candidates").EnumerateArray().Any(p => p.GetProperty("id").GetGuid() == id))
                    throw new InvalidOperationException("Agent selected a property outside the permitted candidates.");
                run.PropertyId = id;
                property = await Selected(run, state);
                run.ReviewerId = property.OwnerId;
            }
            state.Outputs[role] = output.Clone();
            state.Attempts = 0;
            step.OutputJson = output.GetRawText();
            step.ValidationResult = "Passed: output contract, property identity and business rules checked.";
            run.Status = state.Outputs.Count == RentalWorkflowRules.Plan.Length ? "AwaitingApproval" : "Ready";
            if (run.Status == "AwaitingApproval") state.ApprovalStatus = "Pending";
        }
        catch (Exception ex) when (ex is not DbUpdateException)
        {
            if (role == "MatchingLocation") { run.PropertyId = null; run.ReviewerId = null; }
            state.Error = ex is InvalidOperationException ? ex.Message : "Agent execution failed safely. No agreement was created. Retry this step.";
            step.ValidationResult = "Failed: " + state.Error;
            run.Status = "Failed";
        }
        step.UpdatedAt = DateTime.UtcNow;
        run.UpdatedAt = DateTime.UtcNow;
        run.StateJson = RentalWorkflowRules.Serialize(state);
        run.Version++;
        await db.SaveChangesAsync();
    }

    public async Task Decide(AgentWorkflowRun run, Guid actorId, WorkflowDecision decision)
    {
        if (run.Status != "AwaitingApproval" || run.Version != decision.Version)
            throw new InvalidOperationException("This review has changed or was already decided. Refresh before reviewing.");
        if (decision.Decision is not ("approve" or "reject" or "revise") || decision.Note.Length > 2000)
            throw new InvalidOperationException("Invalid review decision.");
        var state = RentalWorkflowRules.Read(run.StateJson);
        if (decision.Decision != "approve" && string.IsNullOrWhiteSpace(decision.Note))
            throw new InvalidOperationException("Explain the rejection or requested revision.");
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        if (decision.Decision == "approve")
        {
            RentalWorkflowRules.ValidateRequest(state.Request);
            var property = await Selected(run, state);
            if (property.OwnerId != run.ReviewerId) throw new InvalidOperationException("Property ownership changed. Start a new workflow.");
            if (RentalWorkflowRules.Plan.Any(role => !state.Outputs.ContainsKey(role)))
                throw new InvalidOperationException("Every agent step must pass before approval.");
            foreach (var role in RentalWorkflowRules.Plan)
                RentalWorkflowRules.ValidateOutput(role, state.Outputs[role], property.Id, property.MonthlyRent);
            var draft = state.Outputs["AgreementPricing"];
            var agreement = new RentalAgreement
            {
                PropertyId = property.Id, OwnerId = property.OwnerId, TenantId = run.RequestedById!.Value,
                AgreedMonthlyRent = property.MonthlyRent, SecurityDeposit = 0,
                StartDate = state.Request.StartDate, EndDate = state.Request.EndDate,
                Status = AgreementStatus.Drafted,
                TermsAndConditions = draft.GetProperty("terms").GetString()!,
                AIMarketRentAssessment = draft.GetProperty("summary").GetString()!
            };
            db.RentalAgreements.Add(agreement);
            run.AgreementId = agreement.Id;
            run.Status = "Completed";
            state.ApprovalStatus = "Approved";
        }
        else
        {
            run.Status = decision.Decision == "reject" ? "Rejected" : "RevisionRequested";
            state.ApprovalStatus = run.Status;
        }
        state.Decisions.Add(new { actorId, decision = decision.Decision, note = decision.Note, at = DateTime.UtcNow });
        run.Version++;
        run.UpdatedAt = DateTime.UtcNow;
        run.StateJson = RentalWorkflowRules.Serialize(state);
        db.AgentWorkflowSteps.Add(new AgentWorkflowStep
        {
            WorkflowId = run.Id, Sequence = 5, Attempt = 1, AgentName = "HumanApproval",
            InputJson = RentalWorkflowRules.Serialize(new { decision.Decision, decision.Note, actorId }),
            OutputJson = RentalWorkflowRules.Serialize(new { run.Status, run.AgreementId }),
            ValidationResult = "Passed: authorized reviewer, version, availability and stored outputs checked."
        });
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
    }
}
