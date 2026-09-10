using Microsoft.EntityFrameworkCore;
using RentWise_Backend.Data;
using RentWise_Backend.DTOs;
using RentWise_Backend.Models;

namespace RentWise_Backend.Services;

// Internal rules only. HTTP access stays closed until shared authorization exists.
public sealed class RentalAgreementService(AppDbContext context, IAgreementApprovalIntegration approvals)
{
    public async Task<AgreementResponse> CreateDraftAsync(CreateAgreementDraftRequest request,
        CancellationToken cancellationToken = default)
    {
        ComponentCValidation.Validate(request);
        ComponentCValidation.ValidateMoney(request.MonthlyRent);
        if (request.StartDate == default || request.EndDate == default || request.StartDate >= request.EndDate)
            throw new ComponentCException(400, "StartDate must be before EndDate; both dates are required.");
        if (request.StartDate.Kind != DateTimeKind.Utc || request.EndDate.Kind != DateTimeKind.Utc)
            throw new ComponentCException(400, "Agreement dates must be UTC (use the Z suffix).");

        // TODO(team): resolve an Accepted Application and derive its property, owner and tenant.
        // These IDs are provisional internal inputs, not trusted client identity claims.
        var agreement = new RentalAgreement
        {
            ApplicationId = request.ApplicationId, PropertyId = request.PropertyId,
            TenantId = request.TenantId, OwnerId = request.OwnerId, MonthlyRent = request.MonthlyRent,
            StartDate = request.StartDate, EndDate = request.EndDate
        };
        context.RentalAgreements.Add(agreement);
        await context.SaveChangesAsync(cancellationToken);
        return Map(agreement);
    }

    public async Task<AgreementResponse> GetAsync(int id, CancellationToken cancellationToken = default)
        => Map(await context.RentalAgreements.AsNoTracking().SingleOrDefaultAsync(a => a.Id == id, cancellationToken)
            ?? throw new ComponentCException(404, "Agreement not found."));

    // TODO(auth): restrict this query to the trusted user's permitted agreements before HTTP access.
    public async Task<IReadOnlyList<AgreementResponse>> ListAsync(int page = 1, int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        if (page < 1 || pageSize < 1 || pageSize > 100 || (long)(page - 1) * pageSize > int.MaxValue)
            throw new ComponentCException(400, "Use a positive page and a pageSize between 1 and 100.");
        var agreements = await context.RentalAgreements.AsNoTracking().OrderByDescending(a => a.CreatedAt)
            .ThenByDescending(a => a.Id).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        return agreements.Select(Map).ToList();
    }

    public Task<AgreementResponse> SubmitForApprovalAsync(int id, CancellationToken cancellationToken = default)
        => TransitionAsync(id, AgreementStatuses.PendingOwnerApproval, cancellationToken);

    public Task<AgreementResponse> RedraftAsync(int id, CancellationToken cancellationToken = default)
        => TransitionAsync(id, AgreementStatuses.Drafted, cancellationToken);

    public Task<AgreementResponse> EndAsync(int id, CancellationToken cancellationToken = default)
        => TransitionAsync(id, AgreementStatuses.Ended, cancellationToken);

    // TODO(auth): require verified Owner ownership before invoking; persist approval atomically
    // with shared workflow state when integrated. Never invoke this method from an AI agent.
    public Task<AgreementResponse> DecideAsync(int id, AgreementDecisionRequest request,
        CancellationToken cancellationToken = default)
    {
        ComponentCValidation.Validate(request);
        var next = request.Decision switch
        {
            AgreementDecision.Approve => AgreementStatuses.Active,
            AgreementDecision.Reject => AgreementStatuses.Rejected,
            AgreementDecision.RequestRevision => AgreementStatuses.RevisionRequested,
            _ => throw new ComponentCException(400, "Unknown agreement decision.")
        };
        return TransitionAsync(id, next, cancellationToken, request);
    }

    private async Task<AgreementResponse> TransitionAsync(int id, string next, CancellationToken cancellationToken,
        AgreementDecisionRequest? decision = null)
    {
        var agreement = await context.RentalAgreements.SingleOrDefaultAsync(a => a.Id == id, cancellationToken)
            ?? throw new ComponentCException(404, "Agreement not found.");
        if (!AgreementStatuses.CanTransition(agreement.Status, next))
            throw new ComponentCException(409, $"Cannot transition from {agreement.Status} to {next}.");
        if (decision is not null)
        {
            var reviewer = await approvals.RequireOwnerAsync(id, agreement.OwnerId, cancellationToken);
            if (string.IsNullOrWhiteSpace(reviewer))
                throw new ComponentCException(503, "Approval integration did not provide a trusted reviewer.");
            await approvals.StageDecisionAsync(new(id, reviewer, decision.Decision,
                string.IsNullOrWhiteSpace(decision.Reason) ? null : decision.Reason.Trim(), DateTime.UtcNow), cancellationToken);
        }
        agreement.TransitionTo(next);
        try { await context.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException)
        {
            throw new ComponentCException(409, "Agreement changed during this decision; reload and retry.");
        }
        return Map(agreement);
    }

    private static AgreementResponse Map(RentalAgreement a) => new(a.Id, a.ApplicationId, a.PropertyId,
        a.TenantId, a.OwnerId, a.MonthlyRent, a.StartDate, a.EndDate, a.Status, a.CreatedAt, a.UpdatedAt);
}
