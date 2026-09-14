using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using RentWise_Backend.Services;

namespace RentWise_Backend.Controllers;

public sealed class ComponentCExceptionFilter : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        if (context.Exception is not ComponentCException error) return;
        context.Result = new ObjectResult(new ProblemDetails
        {
            Status = error.StatusCode, Title = error.Message
        }) { StatusCode = error.StatusCode };
        context.ExceptionHandled = true;
    }
}
