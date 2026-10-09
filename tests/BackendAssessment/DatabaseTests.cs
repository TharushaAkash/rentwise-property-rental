using BackendAssessment.Support;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using RentWise.API.Modules.Agreements.Entities;
using RentWise.API.Modules.Maintenance.Entities;
using RentWise.API.Modules.PropertyManagement.Entities;

namespace BackendAssessment;

[Collection("PostgreSQL assessment")]
public sealed class DatabaseTests(PostgreSqlFixture fixture)
{
    [Fact, Trait("Area", "Database")]
    public async Task DB_01_Agreement_maintenance_and_property_relationships_reload_correctly()
    {
        var seed = await fixture.SeedAsync();
        var agreement = new RentalAgreement { PropertyId = seed.Property.Id, OwnerId = seed.Owner.Id, TenantId = seed.Tenant.Id,
            StartDate = DateTime.UtcNow, EndDate = DateTime.UtcNow.AddMonths(6), AgreedMonthlyRent = 50000 };
        var request = new MaintenanceRequest { PropertyId = seed.Property.Id, TenantId = seed.Tenant.Id, Description = "Leaking tap" };
        await using (var db = fixture.OpenDb()) {
            db.RentalAgreements.Add(agreement); db.MaintenanceRequests.Add(request); await db.SaveChangesAsync();
        }
        await using var fresh = fixture.OpenDb();
        var loadedAgreement = await fresh.RentalAgreements.Include(a => a.Property).Include(a => a.Owner).Include(a => a.Tenant).SingleAsync(a => a.Id == agreement.Id);
        var loadedRequest = await fresh.MaintenanceRequests.Include(m => m.Property).Include(m => m.Tenant).SingleAsync(m => m.Id == request.Id);
        Assert.Equal(seed.Property.Id, loadedAgreement.Property.Id);
        Assert.Equal(seed.Owner.Id, loadedAgreement.Owner.Id); Assert.Equal(seed.Tenant.Id, loadedAgreement.Tenant.Id);
        Assert.Equal(loadedAgreement.Property.Id, loadedRequest.Property.Id);
        Assert.Equal(loadedAgreement.Tenant.Id, loadedRequest.Tenant.Id);
    }
    private static void SqlState(DbUpdateException error, string state) => Assert.Equal(state, Assert.IsType<PostgresException>(error.InnerException).SqlState);
    [Fact, Trait("Area", "Database")]
    public async Task DB_02_Null_required_property_title_is_rejected()
    {
        var seed = await fixture.SeedAsync();
        await using var db = fixture.OpenDb();
        db.Properties.Add(new Property { OwnerId = seed.Owner.Id, Title = null!, Description = "Description", Address = "Colombo" });
        SqlState(await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync()), PostgresErrorCodes.NotNullViolation);
    }
    [Fact, Trait("Area", "Database")]
    public async Task DB_02_Unknown_property_owner_is_rejected_by_foreign_key()
    {
        await using var db = fixture.OpenDb();
        db.Properties.Add(new Property { OwnerId = Guid.NewGuid(), Title = "Orphan house", Description = "Description", Address = "Colombo" });
        SqlState(await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync()), PostgresErrorCodes.ForeignKeyViolation);
    }
    [Fact, Trait("Area", "Database")]
    public async Task DB_02_Active_booking_unique_constraint_rejects_second_reservation()
    {
        var seed = await fixture.SeedAsync();
        await using var db = fixture.OpenDb();
        db.PropertyApplications.Add(new PropertyApplication { PropertyId = seed.Property.Id, TenantId = seed.Tenant.Id, Status = "Submitted" });
        await db.SaveChangesAsync();
        db.PropertyApplications.Add(new PropertyApplication { PropertyId = seed.Property.Id, TenantId = seed.Tenant.Id, Status = "Accepted" });
        SqlState(await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync()), PostgresErrorCodes.UniqueViolation);
    }
    [Fact, Trait("Area", "Database")]
    public async Task DB_02_Owner_with_property_cannot_be_deleted()
    {
        var seed = await fixture.SeedAsync();
        await using var db = fixture.OpenDb();
        var owner = await db.Users.SingleAsync(u => u.Id == seed.Owner.Id);
        db.Users.Remove(owner);
        SqlState(await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync()), PostgresErrorCodes.ForeignKeyViolation);
    }
    [Fact, Trait("Area", "Database")]
    public async Task DB_03_All_real_migrations_applied_and_reapplication_is_idempotent()
    {
        await using var db = fixture.OpenDb();
        var expected = db.Database.GetMigrations().ToArray();
        Assert.NotEmpty(expected);
        Assert.Equal(expected, (await db.Database.GetAppliedMigrationsAsync()).ToArray());
        await db.Database.MigrateAsync();
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());
        Assert.Equal(expected, (await db.Database.GetAppliedMigrationsAsync()).ToArray());
    }
    [Fact, Trait("Area", "Database")]
    public async Task DB_03_Rollback_removes_changes_and_commit_is_visible_from_new_context()
    {
        var seed = await fixture.SeedAsync();
        var rolledBackId = Guid.NewGuid(); var committedId = Guid.NewGuid();
        await using (var db = fixture.OpenDb()) {
            await using var transaction = await db.Database.BeginTransactionAsync();
            db.Properties.Add(new Property { Id = rolledBackId, OwnerId = seed.Owner.Id, Title = "Rollback", Description = "Description", Address = "Colombo" });
            await db.SaveChangesAsync();
            Assert.True(await db.Properties.AnyAsync(p => p.Id == rolledBackId));
            await transaction.RollbackAsync();
        }
        await using (var db = fixture.OpenDb()) {
            Assert.False(await db.Properties.AnyAsync(p => p.Id == rolledBackId));
            await using var transaction = await db.Database.BeginTransactionAsync();
            db.Properties.Add(new Property { Id = committedId, OwnerId = seed.Owner.Id, Title = "Commit", Description = "Description", Address = "Colombo" });
            await db.SaveChangesAsync(); await transaction.CommitAsync();
        }
        await using var fresh = fixture.OpenDb();
        Assert.True(await fresh.Properties.AnyAsync(p => p.Id == committedId));
        Assert.False(await fresh.Properties.AnyAsync(p => p.Id == rolledBackId));
    }
}
