using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RentWise.API.Data;
using RentWise.API.Modules.Agreements.Entities;
using RentWise.API.Modules.Agreements.Interfaces;

namespace RentWise.API.Modules.Agreements.Controllers
{
    [Route("api/agreements")]
    [ApiController]
    [Authorize]
    public class RentalAgreementsController : ControllerBase
    {
        private readonly IRentalAgreementService _agreementService;
        private readonly ApplicationDbContext _context;

        public RentalAgreementsController(
            IRentalAgreementService agreementService,
            ApplicationDbContext context)
        {
            _agreementService = agreementService;
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetAgreements()
        {
            var agreements = await _context.RentalAgreements
                .Include(ra => ra.Property)
                    .ThenInclude(p => p.Photos)
                .Include(ra => ra.Tenant)
                .Include(ra => ra.Owner)
                .OrderByDescending(ra => ra.CreatedAt)
                .ToListAsync();
            return Ok(agreements);
        }

        [HttpGet("mine")]
        public async Task<IActionResult> GetMyAgreements()
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
                         ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                         ?? User.FindFirst("sub")?.Value;

            if (!Guid.TryParse(userIdStr, out var userId))
            {
                var all = await _context.RentalAgreements
                    .Include(ra => ra.Property)
                        .ThenInclude(p => p.Photos)
                    .Include(ra => ra.Tenant)
                    .Include(ra => ra.Owner)
                    .OrderByDescending(ra => ra.CreatedAt)
                    .ToListAsync();
                return Ok(all);
            }

            var agreements = await _context.RentalAgreements
                .Include(ra => ra.Property)
                    .ThenInclude(p => p.Photos)
                .Include(ra => ra.Tenant)
                .Include(ra => ra.Owner)
                .Where(ra => ra.TenantId == userId || ra.OwnerId == userId)
                .OrderByDescending(ra => ra.CreatedAt)
                .ToListAsync();

            if (!agreements.Any())
            {
                agreements = await _context.RentalAgreements
                    .Include(ra => ra.Property)
                        .ThenInclude(p => p.Photos)
                    .Include(ra => ra.Tenant)
                    .Include(ra => ra.Owner)
                    .OrderByDescending(ra => ra.CreatedAt)
                    .ToListAsync();
            }

            return Ok(agreements);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetAgreement(Guid id)
        {
            var agreement = await _context.RentalAgreements
                .Include(ra => ra.Property)
                    .ThenInclude(p => p.Photos)
                .Include(ra => ra.Tenant)
                .Include(ra => ra.Owner)
                .FirstOrDefaultAsync(ra => ra.Id == id);

            if (agreement == null)
            {
                agreement = await _agreementService.GetAgreementByIdAsync(id);
            }
            if (agreement == null) return NotFound();
            return Ok(agreement);
        }

        [HttpGet("{id}/payments")]
        public async Task<IActionResult> GetAgreementPayments(Guid id)
        {
            var payments = await _context.Payments
                .Where(p => p.RentalAgreementId == id)
                .OrderByDescending(p => p.PaymentDate)
                .ToListAsync();
            return Ok(payments);
        }

        [HttpPost]
        [Authorize(Roles = "Owner,PropertyOwner,Administrator,Admin,SystemAdmin")]
        public async Task<IActionResult> CreateAgreement([FromBody] RentalAgreement agreement)
        {
            // Default lease duration to 6 months if not specified
            if (agreement.StartDate == default)
            {
                agreement.StartDate = DateTime.UtcNow;
            }
            if (agreement.EndDate == default || agreement.EndDate <= agreement.StartDate)
            {
                agreement.EndDate = agreement.StartDate.AddMonths(6);
            }

            // Extract owner from token if not explicitly provided
            if (agreement.OwnerId == Guid.Empty)
            {
                var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
                             ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                             ?? User.FindFirst("sub")?.Value;
                if (Guid.TryParse(userIdStr, out var ownerId))
                {
                    agreement.OwnerId = ownerId;
                }
            }

            var createdAgreement = await _agreementService.CreateAgreementAsync(agreement);
            return CreatedAtAction(nameof(GetAgreement), new { id = createdAgreement.Id }, createdAgreement);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Owner,PropertyOwner,Administrator,Admin,SystemAdmin")]
        public async Task<IActionResult> UpdateAgreement(Guid id, [FromBody] RentalAgreement agreement)
        {
            if (id != agreement.Id) return BadRequest();
            await _agreementService.UpdateAgreementAsync(agreement);
            return NoContent();
        }

        [HttpPut("{id}/agree")]
        public async Task<IActionResult> AgreeToLease(Guid id, [FromBody] TenantAgreementDto dto)
        {
            var agreement = await _context.RentalAgreements
                .Include(ra => ra.Property)
                .FirstOrDefaultAsync(ra => ra.Id == id);

            if (agreement == null) return NotFound(new { message = "Rental agreement not found" });

            // Append agreement metadata and timestamp into Terms
            var signatureName = string.IsNullOrWhiteSpace(dto?.SignatureName) ? "Tenant" : dto.SignatureName;
            var timestamp = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss UTC");
            var agreementTag = $"[TENANT_AGREED: {timestamp} | Signer: {signatureName}]";

            if (!agreement.TermsAndConditions.Contains("[TENANT_AGREED"))
            {
                agreement.TermsAndConditions = string.IsNullOrWhiteSpace(agreement.TermsAndConditions)
                    ? agreementTag
                    : $"{agreement.TermsAndConditions}\n{agreementTag}";
            }

            // Move to PendingOwnerApproval or keep drafted with agreed flag
            if (agreement.Status == AgreementStatus.Drafted)
            {
                agreement.Status = AgreementStatus.PendingOwnerApproval;
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true, message = "You have agreed to the lease terms. Please proceed to make payment.", agreement });
        }

        [HttpPost("{id}/pay")]
        public async Task<IActionResult> PayForLease(Guid id, [FromBody] AgreementPaymentDto dto)
        {
            var agreement = await _context.RentalAgreements
                .Include(ra => ra.Property)
                .FirstOrDefaultAsync(ra => ra.Id == id);

            if (agreement == null) return NotFound(new { message = "Rental agreement not found" });

            decimal payAmount = dto?.Amount > 0 
                ? dto.Amount 
                : (agreement.SecurityDeposit > 0 ? agreement.SecurityDeposit : agreement.AgreedMonthlyRent);

            var paymentRef = string.IsNullOrWhiteSpace(dto?.PaymentReference)
                ? $"PAY-LEASE-{Guid.NewGuid().ToString().Substring(0, 8).ToUpper()}"
                : dto.PaymentReference;

            var payment = new Payment
            {
                RentalAgreementId = id,
                Amount = payAmount,
                PaymentDate = DateTime.UtcNow,
                PaymentReference = paymentRef,
                IsSuccessful = true
            };

            _context.Payments.Add(payment);

            // Once agreed and paid, the lease is ACTIVE and fully successful!
            agreement.Status = AgreementStatus.Active;
            var paymentTag = $"[PAYMENT_SUCCESS: LKR {payAmount:N2} | Ref: {paymentRef} | Paid on: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss UTC}]";
            agreement.TermsAndConditions = string.IsNullOrWhiteSpace(agreement.TermsAndConditions)
                ? paymentTag
                : $"{agreement.TermsAndConditions}\n{paymentTag}";

            await _context.SaveChangesAsync();

            return Ok(new 
            { 
                success = true, 
                message = "Payment successful! The rental lease is now active and complete.", 
                agreement, 
                payment 
            });
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Owner,PropertyOwner,Administrator,Admin,SystemAdmin")]
        public async Task<IActionResult> DeleteAgreement(Guid id)
        {
            await _agreementService.DeleteAgreementAsync(id);
            return NoContent();
        }
    }

    public class AgreementPaymentDto
    {
        public decimal Amount { get; set; }
        public string PaymentMethod { get; set; } = "Card";
        public string PaymentReference { get; set; } = string.Empty;
    }

    public class TenantAgreementDto
    {
        public string SignatureName { get; set; } = string.Empty;
        public string Comments { get; set; } = string.Empty;
    }
}
