using Microsoft.AspNetCore.Mvc;
using RentWise_Backend.DTOs;
using RentWise_Backend.Services;

namespace RentWise_Backend.Controllers;

[Route("api/agreements/{agreementId:guid}/payments")]
[ApiController]
[ComponentCApiBoundary]
public sealed class PaymentController(PaymentService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PaymentResponse>>> GetPaymentHistory(Guid agreementId,
        CancellationToken cancellationToken)
        => Ok(await service.GetHistoryAsync(agreementId, cancellationToken));

    [HttpPost]
    public async Task<ActionResult<PaymentResponse>> MakePayment(Guid agreementId, CreatePaymentRequest request,
        CancellationToken cancellationToken)
    {
        var payment = await service.CreateAsync(agreementId, request, cancellationToken);
        return CreatedAtAction(nameof(GetPaymentHistory), new { agreementId }, payment);
    }
}
