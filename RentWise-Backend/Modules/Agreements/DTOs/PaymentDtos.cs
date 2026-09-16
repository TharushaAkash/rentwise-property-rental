using System.ComponentModel.DataAnnotations;

namespace RentWise_Backend.DTOs;

public sealed class CreatePaymentRequest
{
    [Range(typeof(decimal), "0.01", "9999999999.99")] public decimal Amount { get; init; }
    [Required, StringLength(50)] public string PaymentMethod { get; init; } = string.Empty;
}

public sealed record PaymentResponse(Guid Id, Guid RentalAgreementId, decimal Amount,
    DateTime PaymentDate, string Status, string PaymentMethod, DateTime CreatedAt);
