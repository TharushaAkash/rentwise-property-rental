using Microsoft.EntityFrameworkCore;
using RentWise_Backend.Data;
using RentWise_Backend.DTOs;
using RentWise_Backend.Models;

namespace RentWise_Backend.Services;

public sealed class RentReminderService(ApplicationDbContext context, TimeProvider clock)
{
    public async Task<RentReminderResponse> CreateAsync(Guid agreementId, CreateRentReminderRequest request,
        CancellationToken cancellationToken = default)
    {
        var now = clock.GetUtcNow().UtcDateTime;
        if (request.DueDate == default || request.DueDate.Kind != DateTimeKind.Utc || request.DueDate < now)
            throw new ComponentCException(400, "DueDate must be a current or future UTC timestamp.");
        var agreement = await context.RentalAgreements.AsNoTracking()
            .SingleOrDefaultAsync(a => a.Id == agreementId, cancellationToken)
            ?? throw new ComponentCException(404, "Agreement not found.");
        if (agreement.Status != AgreementStatuses.Active)
            throw new ComponentCException(409, "New reminders require an Active agreement.");
        if (request.DueDate < agreement.StartDate || request.DueDate > agreement.EndDate)
            throw new ComponentCException(400, "DueDate must fall within the agreement dates.");
        if (await context.RentReminders.AnyAsync(r => r.RentalAgreementId == agreementId
            && r.DueDate == request.DueDate, cancellationToken))
            throw new ComponentCException(409, "A reminder already exists for this agreement and due date.");

        var reminder = new RentReminder { Id = Guid.NewGuid(), RentalAgreementId = agreementId, DueDate = request.DueDate };
        context.RentReminders.Add(reminder);
        await context.SaveChangesAsync(cancellationToken);
        return Map(reminder, now);
    }

    public async Task<IReadOnlyList<RentReminderResponse>> GetForAgreementAsync(Guid agreementId,
        CancellationToken cancellationToken = default)
    {
        if (!await context.RentalAgreements.AnyAsync(a => a.Id == agreementId, cancellationToken))
            throw new ComponentCException(404, "Agreement not found.");
        var reminders = await context.RentReminders.AsNoTracking()
            .Where(r => r.RentalAgreementId == agreementId).OrderBy(r => r.DueDate).ThenBy(r => r.Id)
            .ToListAsync(cancellationToken);
        var now = clock.GetUtcNow().UtcDateTime;
        return reminders.Select(r => Map(r, now)).ToList();
    }

    public async Task<RentReminderResponse> UpdateAsync(Guid agreementId, Guid reminderId,
        UpdateRentReminderRequest request, CancellationToken cancellationToken = default)
    {
        ComponentCValidation.Validate(request);
        if (!await context.RentalAgreements.AnyAsync(a => a.Id == agreementId, cancellationToken))
            throw new ComponentCException(404, "Agreement not found.");
        var reminder = await context.RentReminders.SingleOrDefaultAsync(
            r => r.Id == reminderId && r.RentalAgreementId == agreementId, cancellationToken)
            ?? throw new ComponentCException(404, "Reminder not found for this agreement.");
        var now = clock.GetUtcNow().UtcDateTime;
        switch (request.Action)
        {
            case RentReminderAction.MarkSent when reminder.Status == RentReminderStatuses.Pending:
                reminder.MarkSent(now);
                break;
            case RentReminderAction.Complete when reminder.Status is RentReminderStatuses.Pending or RentReminderStatuses.Sent:
                reminder.Complete();
                break;
            default:
                throw new ComponentCException(409, "Reminder action is not valid in its current state.");
        }
        try { await context.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException)
        {
            throw new ComponentCException(409, "Reminder changed; reload and retry.");
        }
        return Map(reminder, now);
    }

    private static RentReminderResponse Map(RentReminder reminder, DateTime now) =>
        new(reminder.Id, reminder.RentalAgreementId, reminder.DueDate, reminder.ReminderSentAt,
            reminder.Status != RentReminderStatuses.Completed && reminder.DueDate < now
                ? RentReminderStatuses.Overdue : reminder.Status);
}
