using Microsoft.EntityFrameworkCore;
using RentWise_Backend.DTOs;
using RentWise_Backend.Services;
using Xunit;

namespace RentWise_Backend.Tests;

public sealed class AgreementIntegrationTests
{
    [Theory]
    [InlineData(AgreementDecision.Approve)]
    [InlineData(AgreementDecision.Reject)]
    [InlineData(AgreementDecision.RequestRevision)]
    public async Task Default_adapter_blocks_all_decisions_even_when_service_is_called_directly(AgreementDecision decision)
    {
        using var db = new ComponentCTestDatabase();
        var id = await db.AgreementInState("PendingOwnerApproval");
        var closed = new RentalAgreementService(db.Context, new UnavailableAgreementApprovalIntegration());
        Assert.Equal(503, (await Assert.ThrowsAsync<ComponentCException>(() =>
            closed.DecideAsync(id, new() { Decision = decision }))).StatusCode);
        Assert.Equal("PendingOwnerApproval", (await closed.GetAsync(id)).Status);
    }

    [Theory]
    [InlineData(AgreementDecision.Approve)]
    [InlineData(AgreementDecision.Reject)]
    [InlineData(AgreementDecision.RequestRevision)]
    public async Task Trusted_adapter_receives_owner_and_complete_audit_contract(AgreementDecision decision)
    {
        using var db = new ComponentCTestDatabase();
        var id = await db.AgreementInState("PendingOwnerApproval");
        var before = DateTime.UtcNow;
        await db.Agreements.DecideAsync(id, new() { Decision = decision, Reason = " reviewed terms " });
        Assert.Equal((id, 4), Assert.Single(db.Approvals.Checked));
        var audit = Assert.Single(db.Approvals.Staged);
        Assert.Equal(id, audit.AgreementId);
        Assert.Equal(db.Approvals.ReviewerId, audit.ReviewerUserId);
        Assert.Equal(decision, audit.Decision);
        Assert.Equal("reviewed terms", audit.Reason);
        Assert.InRange(audit.DecidedAt, before, DateTime.UtcNow);
        Assert.Equal(DateTimeKind.Utc, audit.DecidedAt.Kind);
    }

    [Theory]
    [InlineData("denied")]
    [InlineData("audit-failure")]
    [InlineData("missing-reviewer")]
    public async Task Failed_integration_does_not_change_agreement(string failure)
    {
        using var db = new ComponentCTestDatabase();
        var id = await db.AgreementInState("PendingOwnerApproval");
        var before = await db.Agreements.GetAsync(id);
        if (failure == "denied") db.Approvals.DenialStatus = 403;
        if (failure == "audit-failure") db.Approvals.FailAudit = true;
        if (failure == "missing-reviewer") db.Approvals.ReviewerId = "";
        var error = await Assert.ThrowsAsync<ComponentCException>(() =>
            db.Agreements.DecideAsync(id, new() { Decision = AgreementDecision.Approve }));
        Assert.Equal(failure == "denied" ? 403 : 503, error.StatusCode);
        db.Context.ChangeTracker.Clear();
        Assert.Equal(before, await db.Agreements.GetAsync(id));
        Assert.Empty(db.Approvals.Staged);
    }

    [Fact]
    public async Task Excessive_reason_is_rejected_before_integration()
    {
        using var db = new ComponentCTestDatabase();
        var id = await db.AgreementInState("PendingOwnerApproval");
        Assert.Equal(400, (await Assert.ThrowsAsync<ComponentCException>(() =>
            db.Agreements.DecideAsync(id, new() { Decision = AgreementDecision.Approve, Reason = new string('x', 1001) }))).StatusCode);
        Assert.Empty(db.Approvals.Checked);
    }

    [Fact]
    public async Task Revision_can_be_redrafted_resubmitted_and_explicitly_approved()
    {
        using var db = new ComponentCTestDatabase();
        var id = await db.AgreementInState("PendingOwnerApproval");
        await db.Agreements.DecideAsync(id, new() { Decision = AgreementDecision.RequestRevision, Reason = "Review rent" });
        Assert.Equal("Drafted", (await db.Agreements.RedraftAsync(id)).Status);
        Assert.Equal("PendingOwnerApproval", (await db.Agreements.SubmitForApprovalAsync(id)).Status);
        Assert.Equal("Active", (await db.Agreements.DecideAsync(id, new() { Decision = AgreementDecision.Approve })).Status);
        Assert.Equal(new[] { AgreementDecision.RequestRevision, AgreementDecision.Approve },
            db.Approvals.Staged.Select(a => a.Decision));
    }

    [Fact]
    public async Task List_is_deterministic_paginated_and_handles_empty_pages()
    {
        using var db = new ComponentCTestDatabase();
        Assert.Empty(await db.Agreements.ListAsync());
        var first = await db.AgreementInState("Drafted");
        var second = await db.AgreementInState("Drafted");
        // Tie on time exercises the stable ID tiebreaker.
        foreach (var item in await db.Context.RentalAgreements.ToListAsync()) item.CreatedAt = DateTime.UnixEpoch;
        await db.Context.SaveChangesAsync();
        Assert.Equal(second, Assert.Single(await db.Agreements.ListAsync(1, 1)).Id);
        Assert.Equal(first, Assert.Single(await db.Agreements.ListAsync(2, 1)).Id);
        Assert.Empty(await db.Agreements.ListAsync(3, 1));
    }

    [Theory]
    [InlineData(0, 50)]
    [InlineData(1, 0)]
    [InlineData(1, 101)]
    [InlineData(int.MaxValue, 100)]
    public async Task Invalid_pagination_is_rejected(int page, int size)
    {
        using var db = new ComponentCTestDatabase();
        Assert.Equal(400, (await Assert.ThrowsAsync<ComponentCException>(() =>
            db.Agreements.ListAsync(page, size))).StatusCode);
    }
}
