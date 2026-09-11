using Microsoft.AspNetCore.Mvc;
using RentWise_Backend.DTOs;
using RentWise_Backend.Services;

namespace RentWise_Backend.Controllers;

[ApiController]
[Route("api/agreements/{agreementId:int}/reminders")]
[ComponentCApiBoundary]
public sealed class RentReminderController(RentReminderService service) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<RentReminderResponse>> Create(int agreementId,
        CreateRentReminderRequest request, CancellationToken cancellationToken)
    {
        var reminder = await service.CreateAsync(agreementId, request, cancellationToken);
        return CreatedAtAction(nameof(GetForAgreement), new { agreementId }, reminder);
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<RentReminderResponse>>> GetForAgreement(int agreementId,
        CancellationToken cancellationToken)
        => Ok(await service.GetForAgreementAsync(agreementId, cancellationToken));

    [HttpPut("{reminderId:int}/status")]
    public async Task<ActionResult<RentReminderResponse>> UpdateStatus(int agreementId, int reminderId,
        UpdateRentReminderRequest request, CancellationToken cancellationToken)
        => Ok(await service.UpdateAsync(agreementId, reminderId, request, cancellationToken));
}
