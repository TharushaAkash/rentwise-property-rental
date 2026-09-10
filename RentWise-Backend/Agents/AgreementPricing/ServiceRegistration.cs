using Microsoft.Extensions.DependencyInjection.Extensions;
using RentWise_Backend.Services;

namespace RentWise_Backend.Agents.AgreementPricing;

public static class AgreementPricingServiceRegistration
{
    // Component-owned composition hook. Shared Program/coordinator wiring is deferred.
    public static IServiceCollection AddAgreementPricingAgent(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<AgreementPricingAgentOptions>()
            .Bind(configuration.GetSection("ComponentC:AgreementPricing"));
        services.TryAddScoped<IMarketRentTool, SuppliedMarketRentTool>();
        services.TryAddScoped<IAgreementTermsTool, StructuredAgreementTermsTool>();
        services.TryAddScoped<IAgreementSummaryTool, TemplateAgreementSummaryTool>();
        services.AddScoped<AgreementPricingAgent>();
        services.TryAddScoped<IAgreementPricingAgentClient, LocalAgreementPricingAgentClient>();
        return services;
    }

    // Requires the existing Component C RentalAgreementService registration and its shared context.
    public static IServiceCollection AddAgreementDraftAnalysis(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddAgreementPricingAgent(configuration);
        services.AddScoped<AnalyzedAgreementDraftService>();
        return services;
    }
}
