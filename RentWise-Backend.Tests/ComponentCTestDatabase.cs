using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using RentWise_Backend.Data;
using RentWise_Backend.DTOs;
using RentWise_Backend.Services;

namespace RentWise_Backend.Tests;

public sealed class ComponentCTestDatabase : IDisposable
{
    private readonly SqliteConnection connection = new("Data Source=:memory:;Foreign Keys=True");
    public AppDbContext Context { get; }
    public RentalAgreementService Agreements { get; }
    public PaymentService Payments { get; }
    public TestApprovalIntegration Approvals { get; } = new();
    public TestClock Clock { get; } = new();
    public RentReminderService Reminders { get; }

    public ComponentCTestDatabase()
    {
        connection.Open();
        Context = NewContext();
        // Only a fresh, per-test in-memory database. Never touches existing migrations or PostgreSQL.
        Context.Database.EnsureCreated();
        Agreements = new(Context, Approvals);
        Payments = new(Context);
        Reminders = new(Context, Clock);
    }

    public AppDbContext NewContext() => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseSqlite(connection).Options);

    public static CreateAgreementDraftRequest Draft(decimal rent = 50000, int durationDays = 365) => new()
    {
        ApplicationId = 1, PropertyId = 2, TenantId = 3, OwnerId = 4, MonthlyRent = rent,
        StartDate = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc),
        EndDate = new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc).AddDays(durationDays)
    };

    public async Task<int> AgreementInState(string state)
    {
        var draft = await Agreements.CreateDraftAsync(Draft());
        if (state == "Drafted") return draft.Id;
        await Agreements.SubmitForApprovalAsync(draft.Id);
        if (state == "PendingOwnerApproval") return draft.Id;
        var decision = state switch
        {
            "Rejected" => AgreementDecision.Reject,
            "RevisionRequested" => AgreementDecision.RequestRevision,
            "Active" or "Ended" => AgreementDecision.Approve,
            _ => throw new ArgumentException("Unknown test state.")
        };
        await Agreements.DecideAsync(draft.Id, new() { Decision = decision });
        if (state == "Ended") await Agreements.EndAsync(draft.Id);
        return draft.Id;
    }

    public void Dispose()
    {
        Context.Dispose();
        connection.Dispose();
    }
}

// Test doubles only. No production identity or approval adapter is supplied by this phase.
public sealed class TestApprovalIntegration : IAgreementApprovalIntegration
{
    public string ReviewerId { get; set; } = Guid.NewGuid().ToString();
    public int? DenialStatus { get; set; }
    public bool FailAudit { get; set; }
    public List<AgreementApprovalAudit> Staged { get; } = new();
    public List<(int AgreementId, int OwnerId)> Checked { get; } = new();

    public Task<string> RequireOwnerAsync(int agreementId, int provisionalOwnerId, CancellationToken cancellationToken)
    {
        Checked.Add((agreementId, provisionalOwnerId));
        if (DenialStatus is int status) throw new ComponentCException(status, "Test identity denied.");
        return Task.FromResult(ReviewerId);
    }

    public Task StageDecisionAsync(AgreementApprovalAudit decision, CancellationToken cancellationToken)
    {
        if (FailAudit) throw new ComponentCException(503, "Test audit unavailable.");
        Staged.Add(decision);
        return Task.CompletedTask;
    }
}

public sealed class TestClock : TimeProvider
{
    public DateTimeOffset Now { get; set; } = new(2026, 10, 15, 0, 0, 0, TimeSpan.Zero);
    public override DateTimeOffset GetUtcNow() => Now;
}
