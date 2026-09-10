using Microsoft.EntityFrameworkCore;
using RentWise_Backend.Models;

namespace RentWise_Backend.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        // Component C: Rental Agreement and Payment Management
        public DbSet<RentalAgreement> RentalAgreements => Set<RentalAgreement>();
        public DbSet<Payment> Payments => Set<Payment>();
        public DbSet<RentReminder> RentReminders => Set<RentReminder>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            var agreements = modelBuilder.Entity<RentalAgreement>();
            agreements.Property(a => a.MonthlyRent).HasPrecision(12, 2);
            agreements.Property(a => a.Status).HasMaxLength(30).IsConcurrencyToken();
            agreements.HasIndex(a => a.ApplicationId);
            agreements.HasIndex(a => new { a.OwnerId, a.Status });
            agreements.HasIndex(a => new { a.TenantId, a.Status });
            agreements.HasMany(a => a.Payments).WithOne(p => p.RentalAgreement)
                .HasForeignKey(p => p.RentalAgreementId).OnDelete(DeleteBehavior.Restrict);
            agreements.HasMany(a => a.RentReminders).WithOne(r => r.RentalAgreement)
                .HasForeignKey(r => r.RentalAgreementId).OnDelete(DeleteBehavior.Restrict);

            var payments = modelBuilder.Entity<Payment>();
            payments.Property(p => p.Amount).HasPrecision(12, 2);
            payments.Property(p => p.Status).HasMaxLength(30);
            payments.Property(p => p.PaymentMethod).HasMaxLength(50);
            payments.HasIndex(p => new { p.RentalAgreementId, p.PaymentDate });

            var reminders = modelBuilder.Entity<RentReminder>();
            reminders.Property(r => r.Status).HasMaxLength(30).IsConcurrencyToken();
            reminders.HasIndex(r => new { r.RentalAgreementId, r.DueDate }).IsUnique();
            // User, Property and Application relationships await shared team contracts.
        }
    }
}
