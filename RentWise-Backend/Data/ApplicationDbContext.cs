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
        }
    }
}