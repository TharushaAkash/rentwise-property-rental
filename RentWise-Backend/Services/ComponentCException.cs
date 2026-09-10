using System.ComponentModel.DataAnnotations;

namespace RentWise_Backend.Services;

public sealed class ComponentCException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}

internal static class ComponentCValidation
{
    internal static void Validate(object request)
    {
        var errors = new List<ValidationResult>();
        if (!Validator.TryValidateObject(request, new ValidationContext(request), errors, true))
            throw new ComponentCException(400, string.Join(" ", errors.Select(e => e.ErrorMessage)));
    }

    internal static void ValidateMoney(decimal value)
    {
        if (value <= 0 || value > 9999999999.99m || decimal.Round(value, 2) != value)
            throw new ComponentCException(400, "Money must be positive, at most 9999999999.99, with at most two decimal places.");
    }
}
