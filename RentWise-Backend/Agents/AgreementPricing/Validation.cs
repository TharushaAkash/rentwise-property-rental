namespace RentWise_Backend.Agents.AgreementPricing;

public static class AgreementPricingValidation
{
    private static bool Money(decimal value) => value > 0 && value <= 9999999999.99m && decimal.Round(value, 2) == value;
    private static bool Text(string? value, int max) => !string.IsNullOrWhiteSpace(value) && value.Length <= max;
    private static bool OptionalText(string? value, int max) => value is null || Text(value, max);

    public static void Input(AgreementPricingInput input)
    {
        if (!Money(input.ProposedRent) || input.StartDate == default || input.EndDate == default || input.StartDate >= input.EndDate
            || !OptionalText(input.ApplicationId, 100) || !OptionalText(input.PropertyId, 100)
            || !OptionalText(input.TenantId, 100) || !OptionalText(input.OwnerId, 100)
            || !OptionalText(input.Location, 200) || !OptionalText(input.PropertyType, 100)
            || input.Bedrooms is < 0 or > 100 || !OptionalText(input.TermsDocument, 12000))
            throw new AgentToolException(AgentErrorCode.InvalidInput);
        if (input.MarketReference is not null)
        {
            try { Market(input.MarketReference); }
            catch (AgentToolException) { throw new AgentToolException(AgentErrorCode.InvalidInput); }
        }
    }

    public static void Market(MarketRentReference data)
    {
        if (!Money(data.EstimatedMarketMin) || !Money(data.EstimatedMarketMax)
            || data.EstimatedMarketMin > data.EstimatedMarketMax || !Enum.IsDefined(data.Kind) || !Text(data.Source, 200))
            throw new AgentToolException(AgentErrorCode.InvalidOutput);
    }

    public static void Terms(ExtractedAgreementTerms terms)
    {
        if (!Text(terms.PaymentExpectation, 500) || terms.Conditions is null || terms.Conditions.Length > 10
            || terms.Conditions.Any(c => !Text(c, 300)))
            throw new AgentToolException(AgentErrorCode.MalformedTerms);
    }

    public static MarketAssessment Classify(decimal proposed, decimal min, decimal max)
    {
        if (!Money(proposed) || !Money(min) || !Money(max) || min > max)
            throw new AgentToolException(AgentErrorCode.InvalidInput);
        return proposed < min ? MarketAssessment.BelowRange : proposed > max ? MarketAssessment.AboveRange : MarketAssessment.WithinRange;
    }

    public static void Summary(SummaryToolResult result, DraftTerms expected)
    {
        if (!Text(result.Summary, 5000) || result.DraftTerms is null || result.DraftTerms.Conditions is null
            || result.DraftTerms.MonthlyRent != expected.MonthlyRent || result.DraftTerms.StartDate != expected.StartDate
            || result.DraftTerms.EndDate != expected.EndDate || result.DraftTerms.PaymentExpectation != expected.PaymentExpectation
            || !result.DraftTerms.Conditions.SequenceEqual(expected.Conditions))
            throw new AgentToolException(AgentErrorCode.InvalidOutput);
    }

    public static void Output(AgreementPricingOutput output, AgreementPricingInput input, MarketRentReference market,
        DraftTerms expected)
    {
        if (!output.RequiresOwnerApproval || output.ProposedRent != input.ProposedRent
            || output.EstimatedMarketMin != market.EstimatedMarketMin || output.EstimatedMarketMax != market.EstimatedMarketMax
            || output.MarketAssessment != Classify(input.ProposedRent, market.EstimatedMarketMin, market.EstimatedMarketMax)
            || output.ReferenceKind != market.Kind || output.ReferenceSource != market.Source
            || output.Warnings is null || output.Warnings.Length == 0 || output.Warnings.Any(w => !Text(w, 1000)))
            throw new AgentToolException(AgentErrorCode.InvalidOutput);
        Summary(new SummaryToolResult { Summary = output.Summary, DraftTerms = output.DraftTerms }, expected);
    }
}
