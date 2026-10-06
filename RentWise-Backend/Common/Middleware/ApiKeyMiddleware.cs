using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace RentWise_Backend.Common.Middleware;

// Compatibility shim: a service API key does not identify a signed-in user.
// JWT authentication and endpoint authorization remain responsible for access.
public class ApiKeyMiddleware(RequestDelegate next)
{
    public Task InvokeAsync(HttpContext context, IConfiguration configuration)
        => next(context);
}
