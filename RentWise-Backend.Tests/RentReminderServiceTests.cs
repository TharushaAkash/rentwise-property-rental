using Microsoft.EntityFrameworkCore;
using RentWise_Backend.DTOs;
using RentWise_Backend.Models;
using RentWise_Backend.Services;
using Xunit;

namespace RentWise_Backend.Tests;

public sealed class RentReminderServiceTests
{
    private static DateTime Due => new(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Valid_reminder_persists_pending_and_retrieval_is_scoped_and_ordered()
    {
        using var db = new ComponentCTestDatabase();
        var id = await db.AgreementInState("Active");
        var otherId = await db.AgreementInState("Active");
        var later = await db.Reminders.CreateAsync(id, new() { DueDate = Due.AddMonths(1) });
        var first = await db.Reminders.CreateAsync(id, new() { DueDate = Due });
        await db.Reminders.CreateAsync(otherId, new() { DueDate = Due });
        db.Context.ChangeTracker.Clear();
        Assert.True(first.Id > 0);
        Assert.Equal(id, first.RentalAgreementId);
        Assert.Equal("Pending", first.Status);
        Assert.Null(first.ReminderSentAt);
        Assert.Equal(new[] { first, later }, await db.Reminders.GetForAgreementAsync(id));
    }

    [Theory]
    [InlineData("default")]
    [InlineData("past")]
    [InlineData("unspecified")]
    [InlineData("local")]
    [InlineData("after-end")]
    [InlineData("before-start")]
    public async Task Invalid_due_date_does_not_persist(string scenario)
    {
        using var db = new ComponentCTestDatabase();
        var id = await db.AgreementInState("Active");
        if (scenario == "before-start") db.Clock.Now = new DateTimeOffset(2026, 9, 1, 0, 0, 0, TimeSpan.Zero);
        var due = scenario switch
        {
            "default" => default,
            "past" => db.Clock.Now.UtcDateTime.AddSeconds(-1),
            "unspecified" => DateTime.SpecifyKind(Due, DateTimeKind.Unspecified),
            "local" => DateTime.SpecifyKind(Due, DateTimeKind.Local),
            "after-end" => Due.AddYears(2),
            "before-start" => new DateTime(2026, 9, 15, 0, 0, 0, DateTimeKind.Utc),
            _ => throw new InvalidOperationException()
        };
        var error = await Assert.ThrowsAsync<ComponentCException>(() =>
            db.Reminders.CreateAsync(id, new() { DueDate = due }));
        Assert.Equal(400, error.StatusCode);
        Assert.Empty(await db.Context.RentReminders.ToListAsync());
    }

    [Fact]
    public async Task Missing_agreement_is_rejected_for_create_read_and_update()
    {
        using var db = new ComponentCTestDatabase();
        Assert.Equal(404, (await Assert.ThrowsAsync<ComponentCException>(() =>
            db.Reminders.CreateAsync(999, new() { DueDate = Due }))).StatusCode);
        Assert.Equal(404, (await Assert.ThrowsAsync<ComponentCException>(() =>
            db.Reminders.GetForAgreementAsync(999))).StatusCode);
        Assert.Equal(404, (await Assert.ThrowsAsync<ComponentCException>(() =>
            db.Reminders.UpdateAsync(999, 1, new() { Action = RentReminderAction.Complete }))).StatusCode);
    }

    [Theory]
    [InlineData("Drafted")]
    [InlineData("PendingOwnerApproval")]
    [InlineData("Rejected")]
    [InlineData("RevisionRequested")]
    [InlineData("Ended")]
    public async Task New_reminders_require_active_agreement(string state)
    {
        using var db = new ComponentCTestDatabase();
        var id = await db.AgreementInState(state);
        Assert.Equal(409, (await Assert.ThrowsAsync<ComponentCException>(() =>
            db.Reminders.CreateAsync(id, new() { DueDate = Due }))).StatusCode);
        Assert.Empty(await db.Context.RentReminders.ToListAsync());
    }

    [Fact]
    public async Task Empty_reminder_history_is_distinct_from_missing_agreement()
    {
        using var db = new ComponentCTestDatabase();
        var id = await db.AgreementInState("Active");
        Assert.Empty(await db.Reminders.GetForAgreementAsync(id));
    }

    [Fact]
    public async Task Duplicate_due_date_is_rejected_by_service_and_database()
    {
        using var db = new ComponentCTestDatabase();
        var id = await db.AgreementInState("Active");
        await db.Reminders.CreateAsync(id, new() { DueDate = Due });
        Assert.Equal(409, (await Assert.ThrowsAsync<ComponentCException>(() =>
            db.Reminders.CreateAsync(id, new() { DueDate = Due }))).StatusCode);
        db.Context.RentReminders.Add(new RentReminder { RentalAgreementId = id, DueDate = Due });
        await Assert.ThrowsAsync<DbUpdateException>(() => db.Context.SaveChangesAsync());
    }

    [Fact]
    public async Task Sent_then_completed_preserves_sent_timestamp_and_completion_never_becomes_overdue()
    {
        using var db = new ComponentCTestDatabase();
        var id = await db.AgreementInState("Active");
        var reminder = await db.Reminders.CreateAsync(id, new() { DueDate = Due });
        var sent = await db.Reminders.UpdateAsync(id, reminder.Id, new() { Action = RentReminderAction.MarkSent });
        Assert.Equal("Sent", sent.Status);
        Assert.Equal(db.Clock.Now.UtcDateTime, sent.ReminderSentAt);
        var completed = await db.Reminders.UpdateAsync(id, reminder.Id, new() { Action = RentReminderAction.Complete });
        Assert.Equal("Completed", completed.Status);
        Assert.Equal(sent.ReminderSentAt, completed.ReminderSentAt);
        db.Clock.Now = new DateTimeOffset(Due.AddDays(1));
        db.Context.ChangeTracker.Clear();
        Assert.Equal(completed, Assert.Single(await db.Reminders.GetForAgreementAsync(id)));
        Assert.Equal(409, (await Assert.ThrowsAsync<ComponentCException>(() =>
            db.Reminders.UpdateAsync(id, reminder.Id, new() { Action = RentReminderAction.MarkSent }))).StatusCode);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Unfinished_reminders_become_overdue_without_read_side_effects(bool sent)
    {
        using var db = new ComponentCTestDatabase();
        var id = await db.AgreementInState("Active");
        var reminder = await db.Reminders.CreateAsync(id, new() { DueDate = Due });
        if (sent) await db.Reminders.UpdateAsync(id, reminder.Id, new() { Action = RentReminderAction.MarkSent });
        db.Clock.Now = new DateTimeOffset(Due);
        Assert.Equal(sent ? "Sent" : "Pending", Assert.Single(await db.Reminders.GetForAgreementAsync(id)).Status);
        db.Clock.Now = db.Clock.Now.AddSeconds(1);
        Assert.Equal("Overdue", Assert.Single(await db.Reminders.GetForAgreementAsync(id)).Status);
        db.Context.ChangeTracker.Clear();
        Assert.Equal(sent ? "Sent" : "Pending", (await db.Context.RentReminders.SingleAsync()).Status);
        var completed = await db.Reminders.UpdateAsync(id, reminder.Id, new() { Action = RentReminderAction.Complete });
        Assert.Equal("Completed", completed.Status);
    }

    [Fact]
    public async Task Reminder_cannot_be_updated_through_another_agreement()
    {
        using var db = new ComponentCTestDatabase();
        var id = await db.AgreementInState("Active");
        var other = await db.AgreementInState("Active");
        var reminder = await db.Reminders.CreateAsync(id, new() { DueDate = Due });
        Assert.Equal(404, (await Assert.ThrowsAsync<ComponentCException>(() =>
            db.Reminders.UpdateAsync(other, reminder.Id, new() { Action = RentReminderAction.Complete }))).StatusCode);
        Assert.Equal("Pending", Assert.Single(await db.Reminders.GetForAgreementAsync(id)).Status);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(99)]
    public async Task Unknown_action_is_rejected(int action)
    {
        using var db = new ComponentCTestDatabase();
        var id = await db.AgreementInState("Active");
        var reminder = await db.Reminders.CreateAsync(id, new() { DueDate = Due });
        Assert.Equal(400, (await Assert.ThrowsAsync<ComponentCException>(() =>
            db.Reminders.UpdateAsync(id, reminder.Id, new() { Action = (RentReminderAction)action }))).StatusCode);
        Assert.Equal("Pending", Assert.Single(await db.Reminders.GetForAgreementAsync(id)).Status);
    }

    [Fact]
    public async Task Concurrent_completion_cannot_be_overwritten_by_stale_sent_action()
    {
        using var db = new ComponentCTestDatabase();
        var id = await db.AgreementInState("Active");
        var reminder = await db.Reminders.CreateAsync(id, new() { DueDate = Due });
        using var other = db.NewContext();
        await other.RentReminders.SingleAsync();
        await db.Reminders.UpdateAsync(id, reminder.Id, new() { Action = RentReminderAction.Complete });
        var stale = new RentReminderService(other, db.Clock);
        Assert.Equal(409, (await Assert.ThrowsAsync<ComponentCException>(() =>
            stale.UpdateAsync(id, reminder.Id, new() { Action = RentReminderAction.MarkSent }))).StatusCode);
        Assert.Equal("Completed", Assert.Single(await db.Reminders.GetForAgreementAsync(id)).Status);
    }
}
