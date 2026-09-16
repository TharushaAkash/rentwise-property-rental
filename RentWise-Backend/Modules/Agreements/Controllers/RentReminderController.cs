using Microsoft.AspNetCore.Mvc;
using RentWise_Backend.DTOs;
using RentWise_Backend.Services;

namespace RentWise_Backend.Controllers;

[ApiController]
[Route("api/agreements/{agreementId:guid}/reminders")]
[ComponentCApiBoundary]
public sealed class RentReminderController(RentReminderService service) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<RentReminderResponse>> Create(Guid agreementId,
        CreateRentReminderRequest request, CancellationToken cancellationToken)
    {
        var reminder = await service.CreateAsync(agreementId, request, cancellationToken);
        return CreatedAtAction(nameof(GetForAgreement), new { agreementId }, reminder);
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<RentReminderResponse>>> GetForAgreement(Guid agreementId,
        CancellationToken cancellationToken)
        => Ok(await service.GetForAgreementAsync(agreementId, cancellationToken));

    [HttpPut("{reminderId:guid}/status")]
    public async Task<ActionResult<RentReminderResponse>> UpdateStatus(Guid agreementId, Guid reminderId,
        UpdateRentReminderRequest request, CancellationToken cancellationToken)
        => Ok(await service.UpdateAsync(agreementId, reminderId, request, cancellationToken));
}
