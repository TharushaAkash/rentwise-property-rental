using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RentWise.API.Data;
using RentWise.API.Modules.AgenticAI.Entities;
using RentWise.API.Modules.AgenticAI.Services;

namespace RentWise.API.Modules.AgenticAI.Controllers;

[ApiController, Authorize, Route("api/rental-workflows")]
public class RentalWorkflowsController(ApplicationDbContext db, RentalWorkflowService service) : ControllerBase
{
    private Guid? Actor => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var id) ? id : null;
    private bool Admin => User.IsInRole("Admin") || User.IsInRole("Administrator") || User.IsInRole("SystemAdmin");
    private bool CanRead(AgentWorkflowRun run) => Actor != null && (Admin || run.RequestedById == Actor || run.ReviewerId == Actor);
    private bool CanReview(AgentWorkflowRun run) => Actor != null && Actor != run.RequestedById
        && (Admin || (User.IsInRole("PropertyOwner") && run.ReviewerId == Actor));

    [HttpGet]
    public async Task<IActionResult> List()
    {
        if (Actor == null) return Forbid();
        var query = db.AgentWorkflowRuns.AsNoTracking().Where(r => r.ObjectiveType == "RentalPreparation");
        if (!Admin) query = query.Where(r => r.RequestedById == Actor || r.ReviewerId == Actor);
        return Ok(await query.OrderByDescending(r => r.CreatedAt).Take(100)
            .Select(r => new { r.Id, r.Status, r.CreatedAt, r.UpdatedAt, r.Version, r.PropertyId, r.AgreementId }).ToListAsync());
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var run = await Find(id);
        if (run == null || !CanRead(run)) return NotFound();
        return Ok(new
        {
            run.Id, run.Status, run.Version, run.CreatedAt, run.UpdatedAt, run.PropertyId, run.AgreementId,
            state = RentalWorkflowRules.Read(run.StateJson), canAdvance = Actor == run.RequestedById,
            canReview = CanReview(run),
            steps = await db.AgentWorkflowSteps.AsNoTracking().Where(s => s.WorkflowId == id)
                .OrderBy(s => s.CreatedAt).Select(s => new
                { s.Id, s.AgentName, s.Sequence, s.Attempt, s.CreatedAt, s.UpdatedAt, s.ValidationResult, s.InputJson, s.OutputJson, s.ToolCallsJson }).ToListAsync()
        });
    }

    [HttpPost, Authorize(Roles = "Tenant")]
    public async Task<IActionResult> Start(StartRentalWorkflow request)
    {
        if (Actor == null || !User.IsInRole("Tenant")) return Forbid();
        try
        {
            var run = await service.Start(Actor.Value, request);
            return CreatedAtAction(nameof(Get), new { id = run.Id }, new { run.Id, run.Status });
        }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("{id:guid}/advance")]
    public async Task<IActionResult> Advance(Guid id)
    {
        var run = await Find(id);
        if (run == null || !CanRead(run)) return NotFound();
        if (Actor != run.RequestedById) return Forbid();
        try { await service.Advance(run); return Ok(new { run.Id, run.Status }); }
        catch (DbUpdateConcurrencyException) { return Conflict(new { message = "Another request advanced this workflow. Refresh its status." }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("{id:guid}/decision"), Authorize(Roles = "PropertyOwner,Admin,Administrator,SystemAdmin")]
    public async Task<IActionResult> Decide(Guid id, WorkflowDecision decision)
    {
        var run = await Find(id);
        if (run == null || !CanRead(run)) return NotFound();
        if (!CanReview(run)) return Forbid();
        try { await service.Decide(run, Actor!.Value, decision); return Ok(new { run.Id, run.Status, run.AgreementId }); }
        catch (DbUpdateConcurrencyException) { return Conflict(new { message = "Another reviewer already changed this workflow." }); }
        catch (DbUpdateException) { return Conflict(new { message = "The agreement could not be saved. Refresh and check property availability." }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
        catch (Npgsql.PostgresException ex) when (ex.SqlState == "40001")
        { return Conflict(new { message = "Property availability changed during approval. Refresh and try again." }); }
    }

    [HttpPost("{id:guid}/revise")]
    public async Task<IActionResult> Revise(Guid id, StartRentalWorkflow request)
    {
        var run = await Find(id);
        if (run == null || !CanRead(run)) return NotFound();
        if (Actor != run.RequestedById) return Forbid();
        if (run.Status != "RevisionRequested") return Conflict(new { message = "This workflow is not awaiting revision." });
        try
        {
            RentalWorkflowRules.ValidateRequest(request);
            request.StartDate = DateTime.SpecifyKind(request.StartDate.Date, DateTimeKind.Utc);
            request.EndDate = DateTime.SpecifyKind(request.EndDate.Date, DateTimeKind.Utc);
            var state = RentalWorkflowRules.Read(run.StateJson);
            state.Request = request;
            state.Outputs.Clear();
            state.Attempts = 0;
            state.Error = null;
            state.ApprovalStatus = "NotRequested";
            run.Status = "Ready";
            run.PropertyId = null;
            // Retain the previous reviewer for access to their decision history until re-matching.
            run.Version++;
            run.UpdatedAt = DateTime.UtcNow;
            run.ObjectiveJson = RentalWorkflowRules.Serialize(request);
            run.StateJson = RentalWorkflowRules.Serialize(state);
            db.AgentWorkflowSteps.Add(new AgentWorkflowStep
            {
                WorkflowId = run.Id, AgentName = "Revision", Attempt = 1, InputJson = run.ObjectiveJson,
                OutputJson = RentalWorkflowRules.Serialize(new { plan = state.Plan }),
                ValidationResult = "Passed: revised request validated; prior agent outputs invalidated."
            });
            await db.SaveChangesAsync();
            return Ok(new { run.Id, run.Status });
        }
        catch (DbUpdateConcurrencyException) { return Conflict(new { message = "This revision has already been submitted." }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    private Task<AgentWorkflowRun?> Find(Guid id) => db.AgentWorkflowRuns.SingleOrDefaultAsync(r => r.Id == id && r.ObjectiveType == "RentalPreparation");
}
