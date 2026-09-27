using System.Net.Http.Json;
using System.Text.Json;

namespace RentWise.API.Modules.AgenticAI.Services;

public interface IRentalWorkflowAgentClient
{
    Task<JsonElement> Execute(string role, object input);
}

public class RentalWorkflowAgentClient(IHttpClientFactory factory, IConfiguration config) : IRentalWorkflowAgentClient
{
    public async Task<JsonElement> Execute(string role, object input)
    {
        var baseUrl = (Environment.GetEnvironmentVariable("AgenticServiceUrl") ?? config["AgenticServiceUrl"]
            ?? "https://rentwise-ai-service.onrender.com").TrimEnd('/');
        var key = Environment.GetEnvironmentVariable("AGENT_WORKFLOW_KEY") ?? config["AgentWorkflowKey"];
        if (string.IsNullOrWhiteSpace(key)) throw new InvalidOperationException("Rental workflow service is not configured.");
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/internal/rental-step");
        request.Headers.Add("X-Workflow-Key", key);
        request.Content = JsonContent.Create(new { role, input }, options: RentalWorkflowRules.Json);
        using var response = await factory.CreateClient("AgenticProxy").SendAsync(request);
        if (!response.IsSuccessStatusCode) throw new InvalidOperationException("Agent service could not complete this step. Retry after checking its availability.");
        // Do not persist raw provider errors or model reasoning.
        var body = await response.Content.ReadAsStringAsync();
        if (body.Length > 100000) throw new InvalidOperationException("Agent response exceeded the allowed size.");
        return JsonSerializer.Deserialize<JsonElement>(body);
    }
}
