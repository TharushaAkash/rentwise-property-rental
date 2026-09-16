using Microsoft.EntityFrameworkCore;
using RentWise_Backend.Models;

namespace RentWise_Backend.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(
            DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<User> Users { get; set; }

        public DbSet<TenantProfile> TenantProfiles { get; set; }

        public DbSet<SavedProperty> SavedProperties { get; set; }

        public DbSet<Application> Applications { get; set; }

        // Property Management Module
        public DbSet<RentWise_Backend.Models.PropertyManagement.Property> Properties { get; set; }
        public DbSet<RentWise_Backend.Models.PropertyManagement.PropertyPhoto> PropertyPhotos { get; set; }
        public DbSet<RentWise_Backend.Models.PropertyManagement.PropertyDocument> PropertyDocuments { get; set; }
        public DbSet<RentWise_Backend.Models.PropertyManagement.VerificationRecord> VerificationRecords { get; set; }

        // Component C: Rental Agreement and Payment Management
        public DbSet<RentalAgreement> RentalAgreements { get; set; }
        public DbSet<Payment> Payments { get; set; }
        public DbSet<RentReminder> RentReminders { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // One tenant profile per user
            modelBuilder.Entity<TenantProfile>()
                .HasIndex(t => t.UserId)
                .IsUnique();

            // Prevent saving the same property twice
            modelBuilder.Entity<SavedProperty>()
                .HasIndex(s => new
                {
                    s.TenantProfileId,
                    s.PropertyId
                })
                .IsUnique();

            modelBuilder.Entity<Application>()
                .Property(a => a.Status)
                .HasDefaultValue("Submitted");

            // Rental Agreement configuration
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
        }
    }
}