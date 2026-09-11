using Microsoft.EntityFrameworkCore;
using RentWise_Backend.Data;
using RentWise_Backend.DTOs.Tenant;
using RentWise_Backend.Models;
using RentWise_Backend.Services.Interfaces;

namespace RentWise_Backend.Services
{
    public class TenantProfileService : ITenantProfileService
    {
        private readonly ApplicationDbContext _context;

        public TenantProfileService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<TenantProfile?> GetByUserIdAsync(int userId)
        {
            return await _context.TenantProfiles
                .FirstOrDefaultAsync(t => t.UserId == userId);
        }

        public async Task<TenantProfile> CreateAsync(
            CreateTenantProfileDto dto)
        {
            // Check budget range
            if (dto.PreferredBudgetMin.HasValue &&
                dto.PreferredBudgetMax.HasValue &&
                dto.PreferredBudgetMin > dto.PreferredBudgetMax)
            {
                throw new ArgumentException(
                    "Minimum budget cannot be greater than maximum budget."
                );
            }

            // Check whether this user already has a profile
            var existingProfile =
                await _context.TenantProfiles
                    .FirstOrDefaultAsync(
                        t => t.UserId == dto.UserId
                    );

            if (existingProfile != null)
            {
                throw new InvalidOperationException(
                    "Tenant profile already exists."
                );
            }

            var profile = new TenantProfile
            {
                UserId = dto.UserId,
                PreferredBudgetMin = dto.PreferredBudgetMin,
                PreferredBudgetMax = dto.PreferredBudgetMax,
                PreferredLocationText = dto.PreferredLocationText,
                Occupation = dto.Occupation,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.TenantProfiles.Add(profile);

            await _context.SaveChangesAsync();

            return profile;
        }

        public async Task<TenantProfile?> UpdateAsync(
            int userId,
            UpdateTenantProfileDto dto)
        {
            var profile =
                await _context.TenantProfiles
                    .FirstOrDefaultAsync(
                        t => t.UserId == userId
                    );

            if (profile == null)
            {
                return null;
            }

            if (dto.PreferredBudgetMin.HasValue &&
                dto.PreferredBudgetMax.HasValue &&
                dto.PreferredBudgetMin > dto.PreferredBudgetMax)
            {
                throw new ArgumentException(
                    "Minimum budget cannot be greater than maximum budget."
                );
            }

            profile.PreferredBudgetMin =
                dto.PreferredBudgetMin;

            profile.PreferredBudgetMax =
                dto.PreferredBudgetMax;

            profile.PreferredLocationText =
                dto.PreferredLocationText;

            profile.Occupation =
                dto.Occupation;

            profile.UpdatedAt =
                DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return profile;
        }
    }
}