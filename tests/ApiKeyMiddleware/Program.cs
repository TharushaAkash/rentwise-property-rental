using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Primitives;
using RentWise_Backend.Common.Middleware;

// Exercise the real middleware without connecting to the application's database.
Environment.SetEnvironmentVariable("AgenticServiceApiKey", null);
var configuration = new ConfigurationBuilder().AddInMemoryCollection(
    new Dictionary<string, string?> { ["AgenticServiceApiKey"] = "test-service-key" }).Build();
var nextCalls = 0;
var middleware = new ApiKeyMiddleware(_ => { nextCalls++; return Task.CompletedTask; });

foreach (var (header, expected) in new (StringValues, bool)[] {
    ("test-service-key", false), ("wrong-key", false), ("", false),
    (new StringValues(new[] { "test-service-key", "other" }), false)
})
{
    var context = new DefaultHttpContext();
    context.Request.Headers["X-Api-Key"] = header;
    await middleware.InvokeAsync(context, configuration);
    if ((context.User.Identity?.IsAuthenticated == true) != expected)
        throw new Exception("API key must not bypass user authentication.");
}

var jwtContext = new DefaultHttpContext();
var jwtUser = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.Name, "existing-user") }, "Bearer"));
jwtContext.User = jwtUser;
jwtContext.Request.Headers["X-Api-Key"] = "test-service-key";
await middleware.InvokeAsync(jwtContext, configuration);
if (!ReferenceEquals(jwtUser, jwtContext.User)) throw new Exception("Existing JWT authentication was changed.");
if (jwtContext.User.IsInRole("Admin") || jwtContext.User.IsInRole("Owner"))
    throw new Exception("API key elevated an existing user's roles.");

var unconfigured = new DefaultHttpContext();
unconfigured.Request.Headers["X-Api-Key"] = "test-service-key";
await middleware.InvokeAsync(unconfigured, new ConfigurationBuilder().Build());
if (unconfigured.User.Identity?.IsAuthenticated == true) throw new Exception("Unconfigured key was accepted.");
if (nextCalls != 6) throw new Exception("Middleware did not continue the request pipeline.");
Console.WriteLine("Passed 6 API key middleware regression cases.");
