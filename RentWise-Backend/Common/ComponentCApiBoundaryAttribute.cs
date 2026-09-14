using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace RentWise_Backend.Controllers;

// Temporary fail-closed boundary, not an authentication implementation.
// Replace only when shared identity, resource ownership and approval audit are wired up.
[AttributeUsage(AttributeTargets.Class)]
public sealed class ComponentCApiBoundaryAttribute : Attribute, IResourceFilter
{
    // Run before controller construction/model binding, so no database configuration is
    // needed to return the integration-pending response.
    public void OnResourceExecuting(ResourceExecutingContext context)
    {
        context.Result = new ObjectResult(new ProblemDetails
        {
            Status = StatusCodes.Status503ServiceUnavailable,
            Title = "Component C integration pending",
            Detail = "Agreement and payment access is unavailable until shared identity and authorization are integrated."
        }) { StatusCode = StatusCodes.Status503ServiceUnavailable };
    }

    public void OnResourceExecuted(ResourceExecutedContext context) { }
}
