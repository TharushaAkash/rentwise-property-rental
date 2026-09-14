using System.Diagnostics;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace RentWise_Backend.Agents.AgreementPricing;

public sealed class AgreementPricingAgentOptions
{
    public int TimeoutMilliseconds { get; set; } = 5000;
}

// No DbContext, agreement service, approval adapter or mutation tool is available to this agent.
public sealed class AgreementPricingAgent(IMarketRentTool marketTool, IAgreementTermsTool termsTool,
    IAgreementSummaryTool summaryTool, IOptions<AgreementPricingAgentOptions> options)
{
    public async Task<AgreementPricingResult> AnalyzeJsonAsync(string? json, CancellationToken cancellationToken = default)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(json) || json.Length > 20000) return Failure(AgentErrorCode.InvalidInput, null, [], 0);
            return await AnalyzeAsync(AgreementPricingJson.Deserialize<AgreementPricingInput>(json), cancellationToken);
        }
        catch (JsonException) { return Failure(AgentErrorCode.InvalidInput, null, [], 0); }
    }

    public async Task<AgreementPricingResult> AnalyzeAsync(AgreementPricingInput? input, CancellationToken cancellationToken = default)
    {
        var timer = Stopwatch.StartNew();
        var calls = new List<ToolObservation>();
        AgreementPricingInput? validatedInput = null;
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        try
        {
            if (input is null) throw new AgentToolException(AgentErrorCode.InvalidInput);
            AgreementPricingValidation.Input(input);
            validatedInput = input;
            if (options.Value.TimeoutMilliseconds is < 1 or > 60000) throw new AgentToolException(AgentErrorCode.AgentFailure);
            timeout.CancelAfter(options.Value.TimeoutMilliseconds);
            timeout.Token.ThrowIfCancellationRequested();
            var market = await Call("get_market_rent", () => marketTool.GetMarketRentAsync(input, timeout.Token),
                raw =>
                {
                    if (raw is null) throw new AgentToolException(AgentErrorCode.MissingMarketData);
                    var value = AgreementPricingJson.Deserialize<MarketRentReference>(raw);
                    AgreementPricingValidation.Market(value);
                    return value;
                }, AgentErrorCode.InvalidOutput);
            var terms = await Call("extract_agreement_terms", async () => await termsTool.ExtractAgreementTermsAsync(input.TermsDocument, timeout.Token),
                raw =>
                {
                    var value = AgreementPricingJson.Deserialize<ExtractedAgreementTerms>(raw!);
                    AgreementPricingValidation.Terms(value);
                    return value;
                }, AgentErrorCode.MalformedTerms);
            var draft = new DraftTerms(input.ProposedRent, input.StartDate, input.EndDate, terms.PaymentExpectation, terms.Conditions);
            var summary = await Call("summarize_agreement", async () => await summaryTool.SummarizeAsync(
                draft with { Conditions = [.. draft.Conditions] }, timeout.Token),
                raw =>
                {
                    var value = AgreementPricingJson.Deserialize<SummaryToolResult>(raw!);
                    AgreementPricingValidation.Summary(value, draft);
                    return value;
                }, AgentErrorCode.InvalidOutput);
            var assessment = AgreementPricingValidation.Classify(input.ProposedRent, market.EstimatedMarketMin, market.EstimatedMarketMax);
            var warnings = new List<string>
            {
                "Market comparison is a non-binding estimate, not a valuation.",
                "Simplified terms are not legal advice; supplied conditions are unverified.",
                "Analysis does not approve or activate an agreement. Explicit human Owner approval is required."
            };
            warnings.Add(market.Kind == ReferenceKind.Simulated
                ? "Reference data is simulated for the assignment, not observed market evidence."
                : "Reference data was supplied by the caller and has not been independently verified.");
            if (input.TermsDocument is null) warnings.Add("No agreement terms document was supplied.");
            if (input.Location is null || input.PropertyType is null || input.Bedrooms is null)
                warnings.Add("Property matching details are incomplete; comparable-property suitability is unverified.");
            if (assessment == MarketAssessment.AboveRange) warnings.Add("Proposed rent exceeds the supplied reference range.");
            if (assessment == MarketAssessment.BelowRange) warnings.Add("Proposed rent is below the supplied reference range; verify comparability.");
            var output = new AgreementPricingOutput(summary.Summary, assessment, market.EstimatedMarketMin,
                market.EstimatedMarketMax, input.ProposedRent, draft, warnings.ToArray(), market.Source, market.Kind);
            // Round-trip through the same strict transport schema before returning.
            output = AgreementPricingJson.Deserialize<AgreementPricingOutput>(AgreementPricingJson.Serialize(output));
            AgreementPricingValidation.Output(output, input, market, draft);
            return new(AnalysisStatus.Succeeded, output, null,
                new("AgreementPricingAgent", input, calls.ToArray(), output, true, null, timer.ElapsedMilliseconds, AnalysisStatus.Succeeded));
        }
        catch (OperationCanceledException)
        {
            return Failure(cancellationToken.IsCancellationRequested ? AgentErrorCode.Cancelled : AgentErrorCode.Timeout,
                validatedInput, calls.ToArray(), timer.ElapsedMilliseconds);
        }
        catch (AgentToolException error) { return Failure(error.Code, validatedInput, calls.ToArray(), timer.ElapsedMilliseconds); }
        catch (Exception) { return Failure(AgentErrorCode.AgentFailure, validatedInput, calls.ToArray(), timer.ElapsedMilliseconds); }

        async Task<T> Call<T>(string name, Func<Task<string?>> invoke, Func<string?, T> validate, AgentErrorCode malformed)
        {
            var toolTimer = Stopwatch.StartNew();
            AgentErrorCode? failure = null;
            try
            {
                var raw = await invoke().WaitAsync(timeout.Token);
                if (raw is { Length: > 20000 }) throw new AgentToolException(malformed);
                try { return validate(raw); }
                catch (JsonException) { throw new AgentToolException(malformed); }
                catch (ArgumentNullException) { throw new AgentToolException(malformed); }
            }
            catch (OperationCanceledException)
            {
                failure = cancellationToken.IsCancellationRequested ? AgentErrorCode.Cancelled : AgentErrorCode.Timeout;
                throw;
            }
            catch (AgentToolException error) { failure = error.Code; throw; }
            catch (Exception) { failure = AgentErrorCode.ToolFailure; throw new AgentToolException(failure.Value); }
            finally { calls.Add(new(name, failure is null, toolTimer.ElapsedMilliseconds, failure)); }
        }
    }

    private static AgreementPricingResult Failure(AgentErrorCode code, AgreementPricingInput? input, ToolObservation[] calls, long elapsed)
    {
        var error = new AgentError(code, code switch
        {
            AgentErrorCode.InvalidInput => "Agreement analysis input is missing or invalid.",
            AgentErrorCode.MalformedTerms => "Agreement terms must match the supported structured terms schema.",
            AgentErrorCode.MissingMarketData => "No reference rent data is available; no assessment was generated.",
            AgentErrorCode.ToolFailure => "An analysis tool failed; no recommendation was generated.",
            AgentErrorCode.ModelUnavailable => "The optional summary model is unavailable.",
            AgentErrorCode.InvalidOutput => "An analysis result failed validation.",
            AgentErrorCode.Timeout => "Agreement analysis exceeded its time limit.",
            AgentErrorCode.Cancelled => "Agreement analysis was cancelled.",
            _ => "Agreement analysis is unavailable."
        });
        return new(AnalysisStatus.Failed, null, error,
            new("AgreementPricingAgent", input, calls, null, false, error, elapsed, AnalysisStatus.Failed));
    }
}
