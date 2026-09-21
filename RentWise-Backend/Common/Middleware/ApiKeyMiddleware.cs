using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using System.Threading.Tasks;

namespace RentWise_Backend.Common.Middleware
{
    public class ApiKeyMiddleware
    {
        private readonly RequestDelegate _next;
        private const string ApiKeyHeaderName = "X-Api-Key";

        public ApiKeyMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context, IConfiguration configuration)
        {
            if (context.Request.Headers.TryGetValue(ApiKeyHeaderName, out var extractedApiKey))
            {
                var apiKey = Environment.GetEnvironmentVariable("AgenticServiceApiKey") ?? configuration.GetValue<string>("AgenticServiceApiKey");
                
                if (!string.IsNullOrEmpty(apiKey) && apiKey.Equals(extractedApiKey))
                {
                    // Create a dummy identity so [Authorize] passes
                    var claims = new[] 
                    { 
                        new Claim(ClaimTypes.Name, "AgenticService"), 
                        new Claim(ClaimTypes.Role, "Admin"),
                        new Claim(ClaimTypes.Role, "Owner") 
                    };
                    var identity = new ClaimsIdentity(claims, "ApiKey");
                    var principal = new ClaimsPrincipal(identity);
                    context.User = principal;
                }
            }

            await _next(context);
        }
    }
}
