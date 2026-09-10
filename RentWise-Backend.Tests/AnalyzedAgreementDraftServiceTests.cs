using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RentWise_Backend.Agents.AgreementPricing;
using RentWise_Backend.DTOs;
using RentWise_Backend.Services;
using Xunit;

namespace RentWise_Backend.Tests;

[Trait("Category", "Agent")]
public sealed class AnalyzedAgreementDraftServiceTests
{
    private static AgreementAnalysisContext Context() => new(
        Location: "Demo area", PropertyType: "Apartment", Bedrooms: 2,
        MarketReference: new MarketRentReference { EstimatedMarketMin = 40000, EstimatedMarketMax = 60000,
            Kind = ReferenceKind.Simulated, Source = "Test fixture" });

    private static IOptions<AgreementPricingAgentOptions> Options(int timeout = 5000) =>
        Microsoft.Extensions.Options.Options.Create(new AgreementPricingAgentOptions { TimeoutMilliseconds = timeout });

    private static LocalAgreementPricingAgentClient Local() => new(new AgreementPricingAgent(
        new SuppliedMarketRentTool(), new StructuredAgreementTermsTool(), new TemplateAgreementSummaryTool(), Options()));

    private static AnalyzedAgreementDraftService Service(ComponentCTestDatabase db, IAgreementPricingAgentClient? client = null,
        int timeout = 5000) => new(db.Agreements, client ?? Local(), Options(timeout));

    [Fact]
    public async Task Valid_analysis_creates_persisted_draft_and_returns_summary_without_approval()
    {
        using var db = new ComponentCTestDatabase();
        var response = await Service(db).CreateAsync(ComponentCTestDatabase.Draft(), Context());
        db.Context.ChangeTracker.Clear();
        Assert.Equal(response.Agreement, await db.Agreements.GetAsync(response.Agreement.Id));
        Assert.Equal("Drafted", response.Agreement.Status);
        Assert.Equal(50000, response.Analysis.ProposedRent);
        Assert.Equal(MarketAssessment.WithinRange, response.Analysis.MarketAssessment);
        Assert.True(response.Analysis.RequiresOwnerApproval);
        Assert.True(response.Observation.ValidationPassed);
        Assert.Equal(response.Agreement.ApplicationId.ToString(), response.Observation.Input!.ApplicationId);
        Assert.Empty(db.Approvals.Checked);
        Assert.Empty(db.Approvals.Staged);
        Assert.Equal(3, db.Context.Model.GetEntityTypes().Count()); // No duplicate shared state tables.
    }

    [Theory]
    [InlineData("rent")]
    [InlineData("approval")]
    [InlineData("metadata")]
    [InlineData("classification")]
    [InlineData("range")]
    [InlineData("terms")]
    public async Task Mocked_malformed_result_is_rejected_before_persistence(string mutation)
    {
        using var db = new ComponentCTestDatabase();
        var client = new FakeClient(async (input, token) =>
        {
            var valid = await Local().AnalyzeAsync(input, token);
            var output = valid.Output!;
            output = mutation switch
            {
                "rent" => output with { ProposedRent = 1 },
                "approval" => output with { RequiresOwnerApproval = false },
                "classification" => output with { MarketAssessment = MarketAssessment.AboveRange },
                "range" => output with { EstimatedMarketMin = 1 },
                "terms" => output with { DraftTerms = output.DraftTerms with { PaymentExpectation = "Changed" } },
                _ => output
            };
            // Even self-consistent output and metadata must be checked against original input.
            return valid with { Output = output, Observation = valid.Observation with
                { Output = output, ValidationPassed = mutation != "metadata" } };
        });
        Assert.Equal(502, (await Assert.ThrowsAsync<ComponentCException>(() =>
            Service(db, client).CreateAsync(ComponentCTestDatabase.Draft(), Context()))).StatusCode);
        Assert.Empty(await db.Context.RentalAgreements.ToListAsync());
        Assert.Empty(db.Approvals.Checked);
    }

    [Fact]
    public async Task Missing_market_failure_does_not_create_or_activate_agreement()
    {
        using var db = new ComponentCTestDatabase();
        Assert.Equal(502, (await Assert.ThrowsAsync<ComponentCException>(() =>
            Service(db).CreateAsync(ComponentCTestDatabase.Draft(), new AgreementAnalysisContext()))).StatusCode);
        Assert.Empty(await db.Context.RentalAgreements.ToListAsync());
        Assert.Empty(db.Approvals.Staged);
    }

    [Fact]
    public async Task Client_exception_does_not_leak_details_or_persist()
    {
        using var db = new ComponentCTestDatabase();
        var client = new FakeClient((_, _) => throw new InvalidOperationException("secret key"));
        var error = await Assert.ThrowsAsync<ComponentCException>(() =>
            Service(db, client).CreateAsync(ComponentCTestDatabase.Draft(), Context()));
        Assert.Equal(502, error.StatusCode);
        Assert.DoesNotContain("secret key", error.Message);
        Assert.Empty(await db.Context.RentalAgreements.ToListAsync());
    }

    [Fact]
    public async Task Unresponsive_client_times_out_without_creating_agreement()
    {
        using var db = new ComponentCTestDatabase();
        var pending = new TaskCompletionSource<AgreementPricingResult>(TaskCreationOptions.RunContinuationsAsynchronously);
        try
        {
            var client = new FakeClient((_, _) => pending.Task);
            var error = await Assert.ThrowsAsync<ComponentCException>(() =>
                Service(db, client, 20).CreateAsync(ComponentCTestDatabase.Draft(), Context()).WaitAsync(TimeSpan.FromSeconds(3)));
            Assert.Equal(504, error.StatusCode);
            Assert.Empty(await db.Context.RentalAgreements.ToListAsync());
            Assert.Empty(db.Approvals.Staged);
        }
        finally { pending.TrySetCanceled(); }
    }

    [Fact]
    public async Task Reported_agent_timeout_does_not_create_agreement()
    {
        using var db = new ComponentCTestDatabase();
        var client = new FakeClient(async (input, token) =>
        {
            var failed = await Local().AnalyzeAsync(input with { MarketReference = null }, token);
            return failed with { Error = new AgentError(AgentErrorCode.Timeout, "Timeout") };
        });
        Assert.Equal(504, (await Assert.ThrowsAsync<ComponentCException>(() =>
            Service(db, client).CreateAsync(ComponentCTestDatabase.Draft(), Context()))).StatusCode);
        Assert.Empty(await db.Context.RentalAgreements.ToListAsync());
    }

    [Fact]
    public async Task Caller_cancellation_prevents_persistence()
    {
        using var db = new ComponentCTestDatabase();
        using var cancellation = new CancellationTokenSource();
        var client = new FakeClient(async (input, token) =>
        {
            var result = await Local().AnalyzeAsync(input, token);
            cancellation.Cancel();
            return result;
        });
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            Service(db, client).CreateAsync(ComponentCTestDatabase.Draft(), Context(), cancellation.Token));
        Assert.Empty(await db.Context.RentalAgreements.ToListAsync());
    }

    [Fact]
    public async Task Analysis_cannot_replace_explicit_trusted_owner_decision()
    {
        using var db = new ComponentCTestDatabase();
        var draft = await Service(db).CreateAsync(ComponentCTestDatabase.Draft(), Context());
        var id = draft.Agreement.Id;
        Assert.Equal("Drafted", (await db.Agreements.GetAsync(id)).Status);
        await db.Agreements.SubmitForApprovalAsync(id);
        var closed = new RentalAgreementService(db.Context, new UnavailableAgreementApprovalIntegration());
        Assert.Equal(503, (await Assert.ThrowsAsync<ComponentCException>(() =>
            closed.DecideAsync(id, new() { Decision = AgreementDecision.Approve }))).StatusCode);
        Assert.Equal("PendingOwnerApproval", (await closed.GetAsync(id)).Status);
        Assert.Equal("Active", (await db.Agreements.DecideAsync(id,
            new() { Decision = AgreementDecision.Approve, Reason = "Human review test" })).Status);
        Assert.Single(db.Approvals.Checked);
        Assert.Single(db.Approvals.Staged);
    }

    [Fact]
    public async Task Invalid_draft_is_rejected_before_client_invocation()
    {
        using var db = new ComponentCTestDatabase();
        var called = false;
        var client = new FakeClient((_, _) => { called = true; throw new InvalidOperationException(); });
        Assert.Equal(400, (await Assert.ThrowsAsync<ComponentCException>(() =>
            Service(db, client).CreateAsync(ComponentCTestDatabase.Draft(rent: 0), Context()))).StatusCode);
        Assert.False(called);
        Assert.Empty(await db.Context.RentalAgreements.ToListAsync());
    }

    [Fact]
    public void Audit_workflow_reference_is_optional_and_transport_only()
    {
        var audit = new AgreementApprovalAudit(1, Guid.NewGuid().ToString(), AgreementDecision.Approve,
            "Reviewed", DateTime.UtcNow, "trusted-workflow-reference");
        Assert.Equal("trusted-workflow-reference", audit.WorkflowId);
        using var db = new ComponentCTestDatabase();
        Assert.Null(db.Context.Model.FindEntityType(typeof(AgreementApprovalAudit)));
    }

    [Fact]
    public async Task Component_composition_preserves_a_replacement_client()
    {
        using var db = new ComponentCTestDatabase();
        var calls = 0;
        var client = new FakeClient((input, token) => { calls++; return Local().AnalyzeAsync(input, token); });
        var services = new ServiceCollection();
        services.AddScoped(_ => db.Agreements);
        services.AddScoped<IAgreementPricingAgentClient>(_ => client);
        services.AddAgreementDraftAnalysis(new ConfigurationBuilder().Build());
        using var provider = services.BuildServiceProvider(new ServiceProviderOptions { ValidateOnBuild = true, ValidateScopes = true });
        using var scope = provider.CreateScope();
        var result = await scope.ServiceProvider.GetRequiredService<AnalyzedAgreementDraftService>()
            .CreateAsync(ComponentCTestDatabase.Draft(), Context());
        Assert.Equal(1, calls);
        Assert.Equal("Drafted", result.Agreement.Status);
    }

    private sealed class FakeClient(Func<AgreementPricingInput, CancellationToken, Task<AgreementPricingResult>> handler)
        : IAgreementPricingAgentClient
    {
        public Task<AgreementPricingResult> AnalyzeAsync(AgreementPricingInput input, CancellationToken cancellationToken)
            => handler(input, cancellationToken);
    }
}
