using Microsoft.EntityFrameworkCore;
using RentWise_Backend.Data;
using RentWise_Backend.Models;
using Xunit;

namespace RentWise_Backend.Tests;

public sealed class RelationshipTests
{
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Database_rejects_orphan_dependents(bool payment)
    {
        using var db = new ComponentCTestDatabase();
        if (payment)
            db.Context.Payments.Add(new Payment { RentalAgreementId = 999, Amount = 10, PaymentMethod = "Test" });
        else
            db.Context.RentReminders.Add(new RentReminder { RentalAgreementId = 999, DueDate = DateTime.UtcNow });
        await Assert.ThrowsAsync<DbUpdateException>(() => db.Context.SaveChangesAsync());
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Database_prevents_deleting_agreement_with_dependents(bool payment)
    {
        using var db = new ComponentCTestDatabase();
        var id = await db.AgreementInState("Active");
        if (payment)
            await db.Payments.CreateAsync(id, new() { Amount = 10, PaymentMethod = "Test" });
        else
        {
            db.Context.RentReminders.Add(new RentReminder { RentalAgreementId = id, DueDate = DateTime.UtcNow });
            await db.Context.SaveChangesAsync();
        }
        db.Context.ChangeTracker.Clear();
        db.Context.RentalAgreements.Remove(await db.Context.RentalAgreements.SingleAsync(a => a.Id == id));
        await Assert.ThrowsAsync<DbUpdateException>(() => db.Context.SaveChangesAsync());
    }

    [Fact]
    public async Task Both_navigation_collections_load_from_persistence()
    {
        using var db = new ComponentCTestDatabase();
        var id = await db.AgreementInState("Active");
        await db.Payments.CreateAsync(id, new() { Amount = 10, PaymentMethod = "Test" });
        db.Context.RentReminders.Add(new RentReminder { RentalAgreementId = id, DueDate = DateTime.UtcNow });
        await db.Context.SaveChangesAsync();
        db.Context.ChangeTracker.Clear();
        var agreement = await db.Context.RentalAgreements.Include(a => a.Payments)
            .Include(a => a.RentReminders).SingleAsync(a => a.Id == id);
        Assert.Same(agreement, Assert.Single(agreement.Payments).RentalAgreement);
        Assert.Same(agreement, Assert.Single(agreement.RentReminders).RentalAgreement);
    }

    [Fact]
    public void PostgreSql_model_has_money_precision_and_only_internal_relationships()
    {
        // Model-only inspection: this never opens a PostgreSQL connection or executes migrations.
        using var context = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=localhost;Database=unused").Options);
        var agreement = context.Model.FindEntityType(typeof(RentalAgreement))!;
        var payment = context.Model.FindEntityType(typeof(Payment))!;
        var reminder = context.Model.FindEntityType(typeof(RentReminder))!;
        foreach (var property in new[] { agreement.FindProperty("MonthlyRent")!, payment.FindProperty("Amount")! })
        {
            Assert.Equal(12, property.GetPrecision());
            Assert.Equal(2, property.GetScale());
        }
        Assert.Empty(agreement.GetForeignKeys());
        foreach (var dependent in new[] { payment, reminder })
        {
            var fk = Assert.Single(dependent.GetForeignKeys());
            Assert.Equal(typeof(int), Assert.Single(fk.Properties).ClrType);
            Assert.Equal(agreement, fk.PrincipalEntityType);
            Assert.Equal(DeleteBehavior.Restrict, fk.DeleteBehavior);
        }
        Assert.True(agreement.FindProperty("Status")!.IsConcurrencyToken);
        Assert.False(typeof(RentalAgreement).GetProperty("Status")!.SetMethod!.IsPublic);
        Assert.Equal(3, context.Model.GetEntityTypes().Count());
    }
}
