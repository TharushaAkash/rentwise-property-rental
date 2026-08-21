using Microsoft.EntityFrameworkCore;
using RentWise_Backend.Data;
using RentWise_Backend.Models;
using RentWise_Backend.Services.Interfaces;

namespace RentWise_Backend.Services
{
    public class SavedPropertyService : ISavedPropertyService
    {
        private readonly ApplicationDbContext _context;

        public SavedPropertyService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<List<SavedProperty>> GetSavedPropertiesAsync(
            int tenantProfileId)
        {
            return await _context.SavedProperties
                .Where(s => s.TenantProfileId == tenantProfileId)
                .OrderByDescending(s => s.SavedAt)
                .ToListAsync();
        }

        public async Task<SavedProperty> SavePropertyAsync(
            int tenantProfileId,
            int propertyId)
        {
            var tenantExists = await _context.TenantProfiles
                .AnyAsync(t => t.Id == tenantProfileId);

            if (!tenantExists)
            {
                throw new ArgumentException(
                    "Tenant profile does not exist.");
            }

            var alreadySaved = await _context.SavedProperties
                .AnyAsync(s =>
                    s.TenantProfileId == tenantProfileId &&
                    s.PropertyId == propertyId);

            if (alreadySaved)
            {
                throw new InvalidOperationException(
                    "Property is already saved.");
            }

            var savedProperty = new SavedProperty
            {
                TenantProfileId = tenantProfileId,
                PropertyId = propertyId,
                SavedAt = DateTime.UtcNow
            };

            _context.SavedProperties.Add(savedProperty);

            await _context.SaveChangesAsync();

            return savedProperty;
        }

        public async Task<bool> RemoveSavedPropertyAsync(
            int tenantProfileId,
            int propertyId)
        {
            var savedProperty = await _context.SavedProperties
                .FirstOrDefaultAsync(s =>
                    s.TenantProfileId == tenantProfileId &&
                    s.PropertyId == propertyId);

            if (savedProperty == null)
            {
                return false;
            }

            _context.SavedProperties.Remove(savedProperty);

            await _context.SaveChangesAsync();

            return true;
        }
    }
}