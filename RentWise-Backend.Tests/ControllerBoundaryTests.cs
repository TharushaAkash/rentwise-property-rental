using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.Routing;
using RentWise_Backend.Controllers;
using RentWise_Backend.Services;
using Xunit;

namespace RentWise_Backend.Tests;

public sealed class ControllerBoundaryTests
{
    [Theory]
    [InlineData(typeof(AgreementController))]
    [InlineData(typeof(PaymentController))]
    [InlineData(typeof(RentReminderController))]
    public void Http_actions_are_closed_until_shared_authorization_is_integrated(Type controllerType)
    {
        var boundary = Assert.IsType<ComponentCApiBoundaryAttribute>(
            Attribute.GetCustomAttribute(controllerType, typeof(ComponentCApiBoundaryAttribute)));
        var context = new ResourceExecutingContext(
            new ActionContext(new DefaultHttpContext(), new RouteData(), new ActionDescriptor()),
            new List<IFilterMetadata>(), new List<IValueProviderFactory>());
        boundary.OnResourceExecuting(context);
        var result = Assert.IsType<ObjectResult>(context.Result);
        Assert.Equal(503, result.StatusCode);
        Assert.Equal(503, Assert.IsType<ProblemDetails>(result.Value).Status);
    }

    [Theory]
    [InlineData(400)]
    [InlineData(404)]
    [InlineData(409)]
    public void Business_errors_map_to_problem_details(int status)
    {
        var context = new ExceptionContext(
            new ActionContext(new DefaultHttpContext(), new RouteData(), new ActionDescriptor()),
            new List<IFilterMetadata>())
        { Exception = new ComponentCException(status, "Rule rejected.") };
        new ComponentCExceptionFilter().OnException(context);
        Assert.True(context.ExceptionHandled);
        var result = Assert.IsType<ObjectResult>(context.Result);
        Assert.Equal(status, result.StatusCode);
        Assert.Equal("Rule rejected.", Assert.IsType<ProblemDetails>(result.Value).Title);
    }
}
