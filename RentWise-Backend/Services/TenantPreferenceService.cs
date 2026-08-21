using Microsoft.EntityFrameworkCore;
using RentWise_Backend.Data;
using RentWise_Backend.DTOs.Search;
using RentWise_Backend.Services.Interfaces;

namespace RentWise_Backend.Services
{
    public class TenantPreferenceService : ITenantPreferenceService
    {
        private readonly ApplicationDbContext _context;

        public TenantPreferenceService(
            ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<PropertySearchDto?>
            GetSearchPreferencesAsync(int tenantProfileId)
        {
            var tenantProfile = await _context.TenantProfiles
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    t => t.Id == tenantProfileId);

            if (tenantProfile == null)
            {
                return null;
            }

            return new PropertySearchDto
            {
                MinBudget = tenantProfile.PreferredBudgetMin,
                MaxBudget = tenantProfile.PreferredBudgetMax,
                Location = tenantProfile.PreferredLocationText
            };
        }
    }
}