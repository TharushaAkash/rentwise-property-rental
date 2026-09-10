namespace RentWise_Backend.Agents.AgreementPricing;

// Transport-neutral application boundary. Future HTTP clients must deserialize strict JSON,
// honor cancellation and return this same contract. No approval or database capabilities.
public interface IAgreementPricingAgentClient
{
    Task<AgreementPricingResult> AnalyzeAsync(AgreementPricingInput input, CancellationToken cancellationToken);
}

public sealed class LocalAgreementPricingAgentClient(AgreementPricingAgent agent) : IAgreementPricingAgentClient
{
    public Task<AgreementPricingResult> AnalyzeAsync(AgreementPricingInput input, CancellationToken cancellationToken)
        => agent.AnalyzeAsync(input, cancellationToken);
}
