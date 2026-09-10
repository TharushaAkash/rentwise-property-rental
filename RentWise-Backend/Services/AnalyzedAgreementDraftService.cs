using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Options;
using RentWise_Backend.Agents.AgreementPricing;
using RentWise_Backend.DTOs;

namespace RentWise_Backend.Services;

// Component C enrichment only; IDs remain provisional until trusted shared adapters exist.
public sealed record AgreementAnalysisContext(string? Location = null, string? PropertyType = null,
    int? Bedrooms = null, string? TermsDocument = null, MarketRentReference? MarketReference = null);

public sealed record AnalyzedAgreementDraftResponse(AgreementResponse Agreement,
    AgreementPricingOutput Analysis, AgentObservation Observation);

// No submit/decision operations here. A failed or unvalidated analysis never creates a draft.
public sealed class AnalyzedAgreementDraftService(RentalAgreementService agreements,
    IAgreementPricingAgentClient agent, IOptions<AgreementPricingAgentOptions> options)
{
    public async Task<AnalyzedAgreementDraftResponse> CreateAsync(CreateAgreementDraftRequest request,
        AgreementAnalysisContext analysis, CancellationToken cancellationToken = default)
    {
        ComponentCValidation.Validate(request);
        ComponentCValidation.ValidateMoney(request.MonthlyRent);
        if (request.StartDate == default || request.EndDate == default || request.StartDate >= request.EndDate
            || request.StartDate.Kind != DateTimeKind.Utc || request.EndDate.Kind != DateTimeKind.Utc)
            throw new ComponentCException(400, "Draft dates must be UTC with StartDate before EndDate.");
        var input = new AgreementPricingInput
        {
            ApplicationId = request.ApplicationId.ToString(CultureInfo.InvariantCulture),
            PropertyId = request.PropertyId.ToString(CultureInfo.InvariantCulture),
            TenantId = request.TenantId.ToString(CultureInfo.InvariantCulture),
            OwnerId = request.OwnerId.ToString(CultureInfo.InvariantCulture),
            ProposedRent = request.MonthlyRent,
            StartDate = DateOnly.FromDateTime(request.StartDate), EndDate = DateOnly.FromDateTime(request.EndDate),
            Location = analysis.Location, PropertyType = analysis.PropertyType, Bedrooms = analysis.Bedrooms,
            TermsDocument = analysis.TermsDocument, MarketReference = analysis.MarketReference
        };
        try { AgreementPricingValidation.Input(input); }
        catch (AgentToolException) { throw new ComponentCException(400, "Invalid agreement analysis context."); }

        AgreementPricingResult result;
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        var milliseconds = options.Value.TimeoutMilliseconds;
        if (milliseconds is < 1 or > 60000) throw new ComponentCException(503, "Agent integration is not configured correctly.");
        timeout.CancelAfter(milliseconds);
        try
        {
            // Copy the input at the replaceable boundary; validate against the original below.
            result = await agent.AnalyzeAsync(AgreementPricingJson.Deserialize<AgreementPricingInput>(
                AgreementPricingJson.Serialize(input)), timeout.Token).WaitAsync(timeout.Token);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        { throw new ComponentCException(504, "Agreement analysis timed out; no draft was created."); }
        catch (OperationCanceledException) { throw; }
        catch (Exception)
        { throw new ComponentCException(502, "Agreement analysis client failed; no draft was created."); }

        if (result is null) throw InvalidResult();
        if (result.Status == AnalysisStatus.Failed)
        {
            // Never interpret failures as permission to continue with an unanalysed draft.
            throw new ComponentCException(result.Error?.Code == AgentErrorCode.Timeout ? 504 : 502,
                "Agreement analysis failed; no draft was created.");
        }
        ValidateResult(result, input);
        cancellationToken.ThrowIfCancellationRequested();
        var draft = await agreements.CreateDraftAsync(request, cancellationToken);
        return new(draft, result.Output!, result.Observation);
    }

    private static void ValidateResult(AgreementPricingResult result, AgreementPricingInput input)
    {
        try
        {
            if (result.Status != AnalysisStatus.Succeeded || result.Error is not null || result.Output is null
                || result.Observation is null || !result.Observation.ValidationPassed
                || result.Observation.Status != AnalysisStatus.Succeeded || result.Observation.Error is not null
                || result.Observation.Input is null || result.Observation.Output is null
                || result.Observation.DurationMs < 0 || result.Observation.AgentName != "AgreementPricingAgent"
                || result.Observation.ToolCalls is null || result.Observation.ToolCalls.Length is < 1 or > 20
                || result.Observation.ToolCalls.Any(t => t is null || !t.Validated || t.Error is not null
                    || t.DurationMs < 0 || string.IsNullOrWhiteSpace(t.ToolName) || t.ToolName.Length > 100)
                || AgreementPricingJson.Serialize(result.Observation.Input) != AgreementPricingJson.Serialize(input)
                || AgreementPricingJson.Serialize(result.Observation.Output) != AgreementPricingJson.Serialize(result.Output))
                throw InvalidResult();

            var terms = input.TermsDocument is null
                ? new ExtractedAgreementTerms { PaymentExpectation = "No payment schedule or method was supplied.", Conditions = [] }
                : AgreementPricingJson.Deserialize<ExtractedAgreementTerms>(input.TermsDocument);
            AgreementPricingValidation.Terms(terms);
            var expected = new DraftTerms(input.ProposedRent, input.StartDate, input.EndDate, terms.PaymentExpectation, terms.Conditions);
            var market = input.MarketReference ?? new MarketRentReference
            {
                EstimatedMarketMin = result.Output.EstimatedMarketMin, EstimatedMarketMax = result.Output.EstimatedMarketMax,
                Source = result.Output.ReferenceSource, Kind = result.Output.ReferenceKind
            };
            AgreementPricingValidation.Market(market);
            AgreementPricingValidation.Output(result.Output, input, market, expected);
        }
        catch (ComponentCException) { throw; }
        catch (Exception) { throw InvalidResult(); }
    }

    private static ComponentCException InvalidResult() => new(502, "Agreement analysis result is invalid; no draft was created.");
}
