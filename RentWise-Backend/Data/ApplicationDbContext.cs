using Microsoft.EntityFrameworkCore;
using RentWise.API.Modules.Users;
using RentWise.API.Modules.PropertyManagement.Entities;
using RentWise.API.Modules.TenantMatching.Entities;
using RentWise.API.Modules.Agreements.Entities;
using RentWise.API.Modules.Maintenance.Entities;
using RentWise.API.Modules.AgenticAI.Entities;

namespace RentWise.API.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }
        
        public DbSet<PropertyApplication> PropertyApplications { get; set; }
        public DbSet<Property> Properties { get; set; }
        public DbSet<PropertyPhoto> PropertyPhotos { get; set; }
        public DbSet<PropertyDocument> PropertyDocuments { get; set; }
        public DbSet<VerificationRecord> VerificationRecords { get; set; }
        public DbSet<DocumentReviewRequest> DocumentReviewRequests { get; set; }

        public DbSet<TenantProfile> TenantProfiles { get; set; }
        public DbSet<SavedProperty> SavedProperties { get; set; }
        public DbSet<Application> Applications { get; set; }

        public DbSet<RentalAgreement> RentalAgreements { get; set; }
        public DbSet<Payment> Payments { get; set; }
        public DbSet<RentReminder> RentReminders { get; set; }

        public DbSet<MaintenanceRequest> MaintenanceRequests { get; set; }
        public DbSet<RentWise.API.Modules.Maintenance.Entities.ServiceProvider> ServiceProviders { get; set; }
        public DbSet<RequestStatusLog> RequestStatusLogs { get; set; }

        public DbSet<AgentWorkflowRun> AgentWorkflowRuns { get; set; }
        public DbSet<AgentWorkflowStep> AgentWorkflowSteps { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.Entity<AgentWorkflowRun>().HasIndex(r => new { r.RequestedById, r.CreatedAt });
            modelBuilder.Entity<AgentWorkflowRun>().HasIndex(r => new { r.ReviewerId, r.Status });
            
            modelBuilder.Entity<PropertyApplication>().HasOne(a => a.Property).WithMany()
                .HasForeignKey(a => a.PropertyId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<PropertyApplication>().HasOne(a => a.Tenant).WithMany()
                .HasForeignKey(a => a.TenantId).OnDelete(DeleteBehavior.Restrict);
            // A pending/accepted booking reserves the listing, matching the clients' booking rules.
            modelBuilder.Entity<PropertyApplication>().HasIndex(a => a.PropertyId).IsUnique()
                .HasFilter("\"Status\" IN ('Submitted', 'Accepted')");
            modelBuilder.Entity<PropertyApplication>().HasIndex(a => new { a.TenantId, a.CreatedAt });

            // Delete behaviors and relationships config
            modelBuilder.Entity<Property>()
                .HasOne(p => p.Owner)
                .WithMany()
                .HasForeignKey(p => p.OwnerId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<RentalAgreement>()
                .HasOne(ra => ra.Tenant)
                .WithMany()
                .HasForeignKey(ra => ra.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<RentalAgreement>()
                .HasOne(ra => ra.Owner)
                .WithMany()
                .HasForeignKey(ra => ra.OwnerId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Application>()
                .HasOne<TenantProfile>()
                .WithMany()
                .HasForeignKey(a => a.TenantProfileId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<MaintenanceRequest>()
                .HasOne(mr => mr.Tenant)
                .WithMany()
                .HasForeignKey(mr => mr.TenantId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
