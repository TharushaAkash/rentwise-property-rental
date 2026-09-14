using Microsoft.AspNetCore.Mvc;
using RentWise_Backend.DTOs;
using RentWise_Backend.Services;

namespace RentWise_Backend.Controllers;

[Route("api/agreements")]
[ApiController]
[ComponentCApiBoundary]
public sealed class AgreementController(RentalAgreementService service) : ControllerBase
{
    [HttpPost("draft")]
    public async Task<ActionResult<AgreementResponse>> DraftAgreement(CreateAgreementDraftRequest request,
        CancellationToken cancellationToken)
    {
        var agreement = await service.CreateDraftAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetAgreement), new { id = agreement.Id }, agreement);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AgreementResponse>> GetAgreement(int id, CancellationToken cancellationToken)
        => Ok(await service.GetAsync(id, cancellationToken));

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AgreementResponse>>> List(CancellationToken cancellationToken,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        => Ok(await service.ListAsync(page, pageSize, cancellationToken));

    [HttpPost("{id:int}/submit")]
    public async Task<ActionResult<AgreementResponse>> Submit(int id, CancellationToken cancellationToken)
        => Ok(await service.SubmitForApprovalAsync(id, cancellationToken));

    [HttpPut("{id:int}/decision")]
    public async Task<ActionResult<AgreementResponse>> OwnerDecision(int id, AgreementDecisionRequest request,
        CancellationToken cancellationToken)
        => Ok(await service.DecideAsync(id, request, cancellationToken));
}
