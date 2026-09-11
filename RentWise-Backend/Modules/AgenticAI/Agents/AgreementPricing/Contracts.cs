using System.Text.Json;
using System.Text.Json.Serialization;

namespace RentWise_Backend.Agents.AgreementPricing;

public enum MarketAssessment { BelowRange, WithinRange, AboveRange }
public enum ReferenceKind { Simulated, Supplied }
public enum AnalysisStatus { Succeeded, Failed }
public enum AgentErrorCode { InvalidInput, MalformedTerms, MissingMarketData, ToolFailure, ModelUnavailable, InvalidOutput, Timeout, Cancelled, AgentFailure }

// Optional identifiers are opaque integration references, never proof of ownership or acceptance.
public sealed record AgreementPricingInput
{
    public string? ApplicationId { get; init; }
    public string? PropertyId { get; init; }
    public string? TenantId { get; init; }
    public string? OwnerId { get; init; }
    public decimal ProposedRent { get; init; }
    public DateOnly StartDate { get; init; }
    public DateOnly EndDate { get; init; }
    public string? Location { get; init; }
    public string? PropertyType { get; init; }
    public int? Bedrooms { get; init; }
    public string? TermsDocument { get; init; }
    public MarketRentReference? MarketReference { get; init; }
}

public sealed record MarketRentReference
{
    public decimal EstimatedMarketMin { get; init; }
    public decimal EstimatedMarketMax { get; init; }
    public ReferenceKind Kind { get; init; }
    public required string Source { get; init; }
}

public sealed record ExtractedAgreementTerms
{
    public required string PaymentExpectation { get; init; }
    public required string[] Conditions { get; init; }
}

public sealed record DraftTerms(decimal MonthlyRent, DateOnly StartDate, DateOnly EndDate,
    string PaymentExpectation, string[] Conditions);

public sealed record SummaryToolResult
{
    public required string Summary { get; init; }
    public required DraftTerms DraftTerms { get; init; }
}

public sealed record AgreementPricingOutput(string Summary, MarketAssessment MarketAssessment,
    decimal EstimatedMarketMin, decimal EstimatedMarketMax, decimal ProposedRent, DraftTerms DraftTerms,
    string[] Warnings, string ReferenceSource, ReferenceKind ReferenceKind, bool RequiresOwnerApproval = true);

public sealed record AgentError(AgentErrorCode Code, string Message);
public sealed record ToolObservation(string ToolName, bool Validated, long DurationMs, AgentErrorCode? Error);
public sealed record AgentObservation(string AgentName, AgreementPricingInput? Input,
    ToolObservation[] ToolCalls, AgreementPricingOutput? Output, bool ValidationPassed,
    AgentError? Error, long DurationMs, AnalysisStatus Status);

// Returned to the future coordinator for persistence; this is not a shared workflow EF model.
public sealed record AgreementPricingResult(AnalysisStatus Status, AgreementPricingOutput? Output,
    AgentError? Error, AgentObservation Observation);

public static class AgreementPricingJson
{
    public static JsonSerializerOptions Options { get; } = CreateOptions();
    private static JsonSerializerOptions CreateOptions()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
            PropertyNameCaseInsensitive = false,
            NumberHandling = JsonNumberHandling.Strict,
            MaxDepth = 16
        };
        options.Converters.Add(new JsonStringEnumConverter(allowIntegerValues: false));
        options.MakeReadOnly(populateMissingResolver: true);
        return options;
    }

    public static string Serialize<T>(T value) => JsonSerializer.Serialize(value, Options);
    public static T Deserialize<T>(string json) where T : class =>
        JsonSerializer.Deserialize<T>(json, Options) ?? throw new JsonException("Object required.");
}
