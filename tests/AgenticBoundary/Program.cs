using System.Net;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using RentWise.API.Modules.AgenticAI.Controllers;

Environment.SetEnvironmentVariable("AGENT_WORKFLOW_KEY", "fixture-server-key");
var handler = new RecordingHandler();
var controller = new AgenticProxyController(new Factory(handler),
    new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> { ["AgenticServiceUrl"] = "https://internal.invalid" }).Build(),
    NullLogger<AgenticProxyController>.Instance);
controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
controller.Request.Body = new MemoryStream(System.Text.Encoding.UTF8.GetBytes("{}"));
void Check(bool condition) { if (!condition) throw new Exception("Boundary assertion failed"); }
Check(await controller.ProxyPost("internal/rental-step") is NotFoundResult);
Check(await controller.ProxyPost("workflow/draft-agreement") is UnauthorizedResult);
Check(handler.Calls == 0);
var search = (ContentResult)await controller.ProxyPost("workflow/match-location");
Check(search.StatusCode == 429 && search.Content!.Contains("limit"));
Check(handler.Key == "fixture-server-key");
controller.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, "tenant") }, "fixture"));
controller.Request.Body = new MemoryStream();
Check(await controller.ProxyPost("workflow/draft-agreement") is ContentResult);
Environment.SetEnvironmentVariable("AGENT_WORKFLOW_KEY", "");
Check(await controller.ProxyPost("workflow/match-location") is ObjectResult { StatusCode: 503 });
Console.WriteLine("7 AI boundary checks passed.");
sealed class Factory(RecordingHandler handler) : IHttpClientFactory {
    public HttpClient CreateClient(string name) => new(handler, false);
}
sealed class RecordingHandler : HttpMessageHandler {
    public int Calls; public string? Key;
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) {
        Calls++; Key = request.Headers.GetValues("X-Workflow-Key").Single();
        return Task.FromResult(new HttpResponseMessage(HttpStatusCode.TooManyRequests) { Content = new StringContent("{\"message\":\"AI limit reached\"}") });
    }
}
