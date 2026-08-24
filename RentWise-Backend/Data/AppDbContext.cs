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
    }
}