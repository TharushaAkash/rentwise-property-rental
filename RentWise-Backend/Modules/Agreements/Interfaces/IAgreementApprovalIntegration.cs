using RentWise_Backend.DTOs;

namespace RentWise_Backend.Services;

// Component C port only: no User, JWT or shared workflow entity is implemented here.
public interface IAgreementApprovalIntegration
{
    // Obtain identity from the team's trusted request context, require a human Owner, and verify
    // ownership of agreementId/provisionalOwnerId. Never accept a reviewer supplied by a client/AI.
    // Return the team's canonical user ID as text; do not convert GUID identities to integer IDs.
    Task<string> RequireOwnerAsync(Guid agreementId, Guid provisionalOwnerId, CancellationToken cancellationToken);

    // Stage audit/workflow changes in the SAME scoped AppDbContext/unit of work as the agreement.
    // Do not independently commit or send an external request. The service saves once, atomically.
    Task StageDecisionAsync(AgreementApprovalAudit decision, CancellationToken cancellationToken);
}

// Transport contract for the future adapter, not a competing persisted ApprovalDecision entity.
public sealed record AgreementApprovalAudit(Guid AgreementId, string ReviewerUserId,
    AgreementDecision Decision, string? Reason, DateTime DecidedAt, string? WorkflowId = null);

public sealed class UnavailableAgreementApprovalIntegration : IAgreementApprovalIntegration
{
    public Task<string> RequireOwnerAsync(Guid agreementId, Guid provisionalOwnerId, CancellationToken cancellationToken)
        => throw new ComponentCException(503, "Trusted Owner approval integration is not available.");

    public Task StageDecisionAsync(AgreementApprovalAudit decision, CancellationToken cancellationToken)
        => throw new ComponentCException(503, "Shared approval audit integration is not available.");
}
