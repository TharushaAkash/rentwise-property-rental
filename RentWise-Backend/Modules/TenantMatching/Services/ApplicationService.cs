using Microsoft.EntityFrameworkCore;
using RentWise.API.Data;
using RentWise.API.Modules.TenantMatching.DTOs;
using RentWise.API.Modules.TenantMatching.Entities;
using RentWise.API.Modules.TenantMatching.Interfaces;

namespace RentWise.API.Modules.TenantMatching.Services
{
    public class ApplicationService : IApplicationService
    {
        private readonly ApplicationDbContext _context;

        public ApplicationService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<Application> CreateApplicationAsync(
            CreateApplicationDto dto)
        {
            var tenantExists = await _context.TenantProfiles
                .AnyAsync(t => t.Id == dto.TenantProfileId);

            if (!tenantExists)
            {
                throw new ArgumentException(
                    "Tenant profile does not exist.");
            }

            var existingApplication = await _context.Applications
                .AnyAsync(a =>
                    a.TenantProfileId == dto.TenantProfileId &&
                    a.PropertyId == dto.PropertyId &&
                    a.Status != "Rejected");

            if (existingApplication)
            {
                throw new InvalidOperationException(
                    "You have already applied for this property.");
            }

            var application = new Application
            {
                TenantProfileId = dto.TenantProfileId,
                PropertyId = dto.PropertyId,
                Status = "Submitted",
                AppliedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Applications.Add(application);

            await _context.SaveChangesAsync();

            return application;
        }

        public async Task<Application?> GetApplicationByIdAsync(
            int applicationId)
        {
            return await _context.Applications
                .FirstOrDefaultAsync(
                    a => a.Id == applicationId);
        }

        public async Task<List<Application>>
            GetTenantApplicationsAsync(int tenantProfileId)
        {
            return await _context.Applications
                .Where(a =>
                    a.TenantProfileId == tenantProfileId)
                .OrderByDescending(a => a.AppliedAt)
                .ToListAsync();
        }

        public async Task<Application?> UpdateStatusAsync(
            int applicationId,
            UpdateApplicationStatusDto dto)
        {
            var application = await _context.Applications
                .FirstOrDefaultAsync(
                    a => a.Id == applicationId);

            if (application == null)
            {
                return null;
            }

            var allowedStatuses = new[]
            {
                "Submitted",
                "Under Review",
                "Accepted",
                "Rejected"
            };

            var requestedStatus = dto.Status.Trim();

            var validStatus = allowedStatuses
                .FirstOrDefault(s =>
                    s.Equals(
                        requestedStatus,
                        StringComparison.OrdinalIgnoreCase));

            if (validStatus == null)
            {
                throw new ArgumentException(
                    "Invalid application status.");
            }

            application.Status = validStatus;
            application.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return application;
        }
    }
}
