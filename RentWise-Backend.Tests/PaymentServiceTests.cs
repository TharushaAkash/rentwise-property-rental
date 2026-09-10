using Microsoft.EntityFrameworkCore;
using RentWise_Backend.DTOs;
using RentWise_Backend.Services;
using Xunit;

namespace RentWise_Backend.Tests;

public sealed class PaymentServiceTests
{
    [Fact]
    public async Task History_orders_newest_first_with_stable_id_tiebreaker()
    {
        using var db = new ComponentCTestDatabase();
        var id = await db.AgreementInState("Active");
        var first = await db.Payments.CreateAsync(id, Request(10));
        var second = await db.Payments.CreateAsync(id, Request(20));
        var third = await db.Payments.CreateAsync(id, Request(30));
        var rows = await db.Context.Payments.ToListAsync();
        foreach (var row in rows) row.PaymentDate = DateTime.UnixEpoch;
        rows.Single(p => p.Id == first.Id).PaymentDate = DateTime.UnixEpoch.AddDays(1);
        await db.Context.SaveChangesAsync();
        var history = await db.Payments.GetHistoryAsync(id);
        Assert.Equal(first.Id, history[0].Id);
        Assert.Equal(new[] { second.Id, third.Id }.OrderBy(x => x), history.Skip(1).Select(p => p.Id));
    }

    private static CreatePaymentRequest Request(decimal amount = 50000) =>
        new() { Amount = amount, PaymentMethod = " BankTransfer " };

    [Fact]
    public async Task Positive_payment_is_persisted_for_active_agreement_and_history_is_scoped()
    {
        using var db = new ComponentCTestDatabase();
        var id = await db.AgreementInState("Active");
        var otherId = await db.AgreementInState("Active");
        var payment = await db.Payments.CreateAsync(id, Request());
        await db.Payments.CreateAsync(otherId, Request(100));
        db.Context.ChangeTracker.Clear();
        var saved = Assert.Single(await db.Payments.GetHistoryAsync(id));
        Assert.Equal(payment, saved);
        Assert.NotEqual(Guid.Empty, saved.Id);
        Assert.Equal(id, saved.RentalAgreementId);
        Assert.Equal(50000m, saved.Amount);
        Assert.Equal("Pending", saved.Status);
        Assert.Equal("BankTransfer", saved.PaymentMethod);
        Assert.NotEqual(default, saved.PaymentDate);
        Assert.Equal(saved.CreatedAt, saved.PaymentDate);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-100)]
    [InlineData(1.001)]
    [InlineData(10000000000)]
    public async Task Invalid_amount_is_rejected(decimal amount)
    {
        using var db = new ComponentCTestDatabase();
        var id = await db.AgreementInState("Active");
        var error = await Assert.ThrowsAsync<ComponentCException>(() => db.Payments.CreateAsync(id, Request(amount)));
        Assert.Equal(400, error.StatusCode);
        Assert.Empty(await db.Context.Payments.ToListAsync());
    }

    [Theory]
    [InlineData("Drafted")]
    [InlineData("PendingOwnerApproval")]
    [InlineData("Rejected")]
    [InlineData("RevisionRequested")]
    [InlineData("Ended")]
    public async Task Non_active_agreement_rejects_payment(string state)
    {
        using var db = new ComponentCTestDatabase();
        var id = await db.AgreementInState(state);
        var error = await Assert.ThrowsAsync<ComponentCException>(() => db.Payments.CreateAsync(id, Request()));
        Assert.Equal(409, error.StatusCode);
        Assert.Empty(await db.Context.Payments.ToListAsync());
    }

    [Fact]
    public async Task Missing_agreement_rejects_payment_and_history_lookup()
    {
        using var db = new ComponentCTestDatabase();
        Assert.Equal(404, (await Assert.ThrowsAsync<ComponentCException>(() =>
            db.Payments.CreateAsync(999, Request()))).StatusCode);
        Assert.Equal(404, (await Assert.ThrowsAsync<ComponentCException>(() =>
            db.Payments.GetHistoryAsync(999))).StatusCode);
        Assert.Empty(await db.Context.Payments.ToListAsync());
    }

    [Fact]
    public async Task Existing_agreement_without_payments_has_empty_history()
    {
        using var db = new ComponentCTestDatabase();
        var id = await db.AgreementInState("Drafted");
        Assert.Empty(await db.Payments.GetHistoryAsync(id));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")]
    public async Task Invalid_payment_method_is_rejected(string method)
    {
        using var db = new ComponentCTestDatabase();
        var id = await db.AgreementInState("Active");
        Assert.Equal(400, (await Assert.ThrowsAsync<ComponentCException>(() =>
            db.Payments.CreateAsync(id, new() { Amount = 10, PaymentMethod = method }))).StatusCode);
        Assert.Empty(await db.Context.Payments.ToListAsync());
    }
}
