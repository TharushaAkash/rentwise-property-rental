using Microsoft.EntityFrameworkCore;
using RentWise_Backend.DTOs;
using RentWise_Backend.Services;
using Xunit;

namespace RentWise_Backend.Tests;

public sealed class RentalAgreementServiceTests
{
    [Fact]
    public async Task Valid_draft_is_persisted_with_terms_and_audit_fields()
    {
        using var db = new ComponentCTestDatabase();
        var result = await db.Agreements.CreateDraftAsync(ComponentCTestDatabase.Draft());
        db.Context.ChangeTracker.Clear();
        var saved = await db.Agreements.GetAsync(result.Id);
        Assert.True(result.Id > 0);
        Assert.Equal(result, saved);
        Assert.Equal("Drafted", saved.Status);
        Assert.Equal(50000m, saved.MonthlyRent);
        Assert.Equal(1, saved.ApplicationId);
        Assert.Equal(2, saved.PropertyId);
        Assert.Equal(3, saved.TenantId);
        Assert.Equal(4, saved.OwnerId);
        Assert.NotEqual(default, saved.CreatedAt);
        Assert.True(saved.UpdatedAt >= saved.CreatedAt);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task Invalid_date_range_is_rejected(int duration)
    {
        using var db = new ComponentCTestDatabase();
        var error = await Assert.ThrowsAsync<ComponentCException>(() =>
            db.Agreements.CreateDraftAsync(ComponentCTestDatabase.Draft(durationDays: duration)));
        Assert.Equal(400, error.StatusCode);
        Assert.Empty(await db.Context.RentalAgreements.ToListAsync());
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(1.001)]
    [InlineData(10000000000)]
    public async Task Invalid_rent_is_rejected(decimal rent)
    {
        using var db = new ComponentCTestDatabase();
        var error = await Assert.ThrowsAsync<ComponentCException>(() =>
            db.Agreements.CreateDraftAsync(ComponentCTestDatabase.Draft(rent)));
        Assert.Equal(400, error.StatusCode);
        Assert.Empty(await db.Context.RentalAgreements.ToListAsync());
    }

    public static IEnumerable<object[]> Transitions()
    {
        string[] states = ["Drafted", "PendingOwnerApproval", "Active", "Rejected", "RevisionRequested", "Ended"];
        string[] actions = ["Submit", "Approve", "Reject", "Revise", "Redraft", "End"];
        var allowed = new Dictionary<(string, string), string>
        {
            [("Drafted", "Submit")] = "PendingOwnerApproval",
            [("PendingOwnerApproval", "Approve")] = "Active",
            [("PendingOwnerApproval", "Reject")] = "Rejected",
            [("PendingOwnerApproval", "Revise")] = "RevisionRequested",
            [("RevisionRequested", "Redraft")] = "Drafted",
            [("Active", "End")] = "Ended"
        };
        foreach (var state in states)
            foreach (var action in actions)
                yield return [state, action, allowed.GetValueOrDefault((state, action))!];
    }

    [Theory]
    [MemberData(nameof(Transitions))]
    public async Task Only_allowed_transitions_persist(string state, string action, string? expected)
    {
        using var db = new ComponentCTestDatabase();
        var id = await db.AgreementInState(state);
        // Use a known old timestamp to verify an actual update without a timing-sensitive sleep.
        var entity = await db.Context.RentalAgreements.SingleAsync(a => a.Id == id);
        entity.UpdatedAt = DateTime.UnixEpoch;
        await db.Context.SaveChangesAsync();
        Task<AgreementResponse> Act() => action switch
        {
            "Submit" => db.Agreements.SubmitForApprovalAsync(id),
            "Redraft" => db.Agreements.RedraftAsync(id),
            "End" => db.Agreements.EndAsync(id),
            _ => db.Agreements.DecideAsync(id, new()
            {
                Decision = action switch
                {
                    "Approve" => AgreementDecision.Approve,
                    "Reject" => AgreementDecision.Reject,
                    _ => AgreementDecision.RequestRevision
                }
            })
        };
        if (expected is null)
        {
            var error = await Assert.ThrowsAsync<ComponentCException>(Act);
            Assert.Equal(409, error.StatusCode);
        }
        else
        {
            Assert.Equal(expected, (await Act()).Status);
        }
        db.Context.ChangeTracker.Clear();
        var saved = await db.Agreements.GetAsync(id);
        Assert.Equal(expected ?? state, saved.Status);
        if (expected is null) Assert.Equal(DateTime.UnixEpoch, saved.UpdatedAt);
        else Assert.True(saved.UpdatedAt > DateTime.UnixEpoch);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(99)]
    public async Task Unknown_decision_is_rejected_without_changing_status(int decision)
    {
        using var db = new ComponentCTestDatabase();
        var id = await db.AgreementInState("PendingOwnerApproval");
        var error = await Assert.ThrowsAsync<ComponentCException>(() =>
            db.Agreements.DecideAsync(id, new() { Decision = (AgreementDecision)decision }));
        Assert.Equal(400, error.StatusCode);
        Assert.Equal("PendingOwnerApproval", (await db.Agreements.GetAsync(id)).Status);
    }

    [Fact]
    public async Task Missing_agreement_returns_not_found()
    {
        using var db = new ComponentCTestDatabase();
        Assert.Equal(404, (await Assert.ThrowsAsync<ComponentCException>(() => db.Agreements.GetAsync(999))).StatusCode);
        Assert.Equal(404, (await Assert.ThrowsAsync<ComponentCException>(() =>
            db.Agreements.SubmitForApprovalAsync(999))).StatusCode);
    }

    [Fact]
    public async Task Stale_decision_cannot_overwrite_another_decision()
    {
        using var db = new ComponentCTestDatabase();
        var id = await db.AgreementInState("PendingOwnerApproval");
        using var other = db.NewContext();
        await other.RentalAgreements.SingleAsync(a => a.Id == id);
        await db.Agreements.DecideAsync(id, new() { Decision = AgreementDecision.Reject });
        var stale = new RentalAgreementService(other, db.Approvals);
        var error = await Assert.ThrowsAsync<ComponentCException>(() =>
            stale.DecideAsync(id, new() { Decision = AgreementDecision.Approve }));
        Assert.Equal(409, error.StatusCode);
        Assert.Equal("Rejected", (await db.Agreements.GetAsync(id)).Status);
    }
}
