using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RentWise.API.Data;
using RentWise.API.Modules.Users;

namespace RentWise.API.Modules.Users.Controllers;

[ApiController, Authorize, Route("api/bank-details")]
public class BankDetailsController(ApplicationDbContext db) : ControllerBase
{
    private Guid? Actor => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var id) ? id : null;
    private bool Owner => User.IsInRole("PropertyOwner") || User.IsInRole("Owner");
    private static object Details(User user) => new { bankName = user.BankName, accountName = user.BankAccountName, accountNumber = user.BankAccountNumber, branch = user.BankBranch,
        configured = !string.IsNullOrWhiteSpace(user.BankName) && !string.IsNullOrWhiteSpace(user.BankAccountName) && !string.IsNullOrWhiteSpace(user.BankAccountNumber) && !string.IsNullOrWhiteSpace(user.BankBranch) };

    [HttpGet("mine")]
    public async Task<IActionResult> Mine()
    {
        if (Actor == null || !Owner) return Forbid();
        var user = await db.Users.FindAsync(Actor.Value);
        return user == null ? NotFound() : Ok(Details(user));
    }

    [HttpPut("mine")]
    public async Task<IActionResult> Save(BankDetailsDto dto)
    {
        if (Actor == null || !Owner) return Forbid();
        if (new[] { dto.BankName, dto.AccountName, dto.AccountNumber, dto.Branch }.Any(string.IsNullOrWhiteSpace))
            return BadRequest(new { message = "Complete all bank details before saving." });
        var user = await db.Users.FindAsync(Actor.Value);
        if (user == null) return NotFound();
        user.BankName = dto.BankName.Trim(); user.BankAccountName = dto.AccountName.Trim();
        user.BankAccountNumber = dto.AccountNumber.Trim(); user.BankBranch = dto.Branch.Trim();
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(Details(user));
    }

    [HttpGet("agreements/{id:guid}")]
    public async Task<IActionResult> ForAgreement(Guid id)
    {
        if (Actor == null) return Forbid();
        var agreement = await db.RentalAgreements.AsNoTracking().SingleOrDefaultAsync(a => a.Id == id && (a.TenantId == Actor || a.OwnerId == Actor));
        if (agreement == null) return NotFound();
        var owner = await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == agreement.OwnerId);
        return owner == null ? NotFound() : Ok(Details(owner));
    }
}

public class BankDetailsDto
{
    [Required, StringLength(120)] public string BankName { get; set; } = "";
    [Required, StringLength(150)] public string AccountName { get; set; } = "";
    [Required, StringLength(40), RegularExpression(@"^[0-9A-Za-z -]{4,40}$")] public string AccountNumber { get; set; } = "";
    [Required, StringLength(120)] public string Branch { get; set; } = "";
}
