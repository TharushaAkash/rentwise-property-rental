using Microsoft.EntityFrameworkCore;
using RentWise_Backend.Data;
using RentWise_Backend.DTOs;
using RentWise_Backend.Models;

namespace RentWise_Backend.Services;

public sealed class PaymentService(AppDbContext context)
{
    public async Task<PaymentResponse> CreateAsync(int agreementId, CreatePaymentRequest request,
        CancellationToken cancellationToken = default)
    {
        ComponentCValidation.Validate(request);
        ComponentCValidation.ValidateMoney(request.Amount);
        if (string.IsNullOrWhiteSpace(request.PaymentMethod))
            throw new ComponentCException(400, "PaymentMethod is required.");
        var agreement = await context.RentalAgreements.AsNoTracking()
            .SingleOrDefaultAsync(a => a.Id == agreementId, cancellationToken)
            ?? throw new ComponentCException(404, "Agreement not found.");
        if (agreement.Status != AgreementStatuses.Active)
            throw new ComponentCException(409, "Payments require an Active agreement.");

        // TODO(auth): verify the authenticated tenant owns this agreement before invoking.
        // This records a Pending payment only; no claim that funds were collected.
        var now = DateTime.UtcNow;
        var payment = new Payment
        {
            Id = Guid.NewGuid(), RentalAgreementId = agreementId, Amount = request.Amount,
            PaymentMethod = request.PaymentMethod.Trim(), PaymentDate = now, CreatedAt = now,
            Status = "Pending"
        };
        context.Payments.Add(payment);
        await context.SaveChangesAsync(cancellationToken);
        return Map(payment);
    }

    public async Task<IReadOnlyList<PaymentResponse>> GetHistoryAsync(int agreementId,
        CancellationToken cancellationToken = default)
    {
        if (!await context.RentalAgreements.AnyAsync(a => a.Id == agreementId, cancellationToken))
            throw new ComponentCException(404, "Agreement not found.");
        var payments = await context.Payments.AsNoTracking().Where(p => p.RentalAgreementId == agreementId)
            .OrderByDescending(p => p.PaymentDate).ThenBy(p => p.Id).ToListAsync(cancellationToken);
        return payments.Select(Map).ToList();
    }

    private static PaymentResponse Map(Payment p) => new(p.Id, p.RentalAgreementId, p.Amount,
        p.PaymentDate, p.Status, p.PaymentMethod, p.CreatedAt);
}
