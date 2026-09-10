using System.Globalization;

namespace RentWise_Backend.Agents.AgreementPricing;

public interface IMarketRentTool
{
    Task<string?> GetMarketRentAsync(AgreementPricingInput input, CancellationToken cancellationToken);
}
public interface IAgreementTermsTool
{
    Task<string> ExtractAgreementTermsAsync(string? document, CancellationToken cancellationToken);
}
public interface IAgreementSummaryTool
{
    Task<string> SummarizeAsync(DraftTerms terms, CancellationToken cancellationToken);
}

// Local reference tool: no fabricated market statistics, scraping, database access or remote API.
public sealed class SuppliedMarketRentTool : IMarketRentTool
{
    public Task<string?> GetMarketRentAsync(AgreementPricingInput input, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return Task.FromResult(input.MarketReference is null ? null : AgreementPricingJson.Serialize(input.MarketReference));
    }
}

// Structured JSON terms only. Arbitrary prose, PDF/OCR and legal interpretation are not supported.
public sealed class StructuredAgreementTermsTool : IAgreementTermsTool
{
    public Task<string> ExtractAgreementTermsAsync(string? document, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return Task.FromResult(document ?? AgreementPricingJson.Serialize(new ExtractedAgreementTerms
        {
            PaymentExpectation = "No payment schedule or method was supplied.",
            Conditions = []
        }));
    }
}

// Deterministic offline summary; no model is claimed to have been called.
// A future model adapter can implement this interface, subject to the same output validation.
public sealed class TemplateAgreementSummaryTool : IAgreementSummaryTool
{
    public Task<string> SummarizeAsync(DraftTerms terms, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var amount = terms.MonthlyRent.ToString("0.00", CultureInfo.InvariantCulture);
        var summary = $"Simplified explanation: monthly rent is LKR {amount}, from {terms.StartDate:yyyy-MM-dd} to {terms.EndDate:yyyy-MM-dd}. "
            + $"Supplied payment expectations: {terms.PaymentExpectation} "
            + (terms.Conditions.Length == 0 ? "No additional conditions were supplied. "
                : "Supplied conditions (unverified): " + string.Join("; ", terms.Conditions) + ". ")
            + "This is not legal advice. A human Owner must review and explicitly approve the agreement.";
        return Task.FromResult(AgreementPricingJson.Serialize(new SummaryToolResult { Summary = summary, DraftTerms = terms }));
    }
}

public sealed class AgentToolException(AgentErrorCode code) : Exception("Agreement pricing tool failed.")
{
    public AgentErrorCode Code { get; } = code;
}
