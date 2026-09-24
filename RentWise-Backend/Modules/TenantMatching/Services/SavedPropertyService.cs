using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RentWise.API.Data;
using RentWise.API.Modules.TenantMatching.Entities;
using RentWise.API.Modules.TenantMatching.Interfaces;

namespace RentWise.API.Modules.TenantMatching.Services
{
    public class SavedPropertyService : ISavedPropertyService
    {
        private readonly ApplicationDbContext _context;

        public SavedPropertyService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<List<SavedProperty>> GetSavedPropertiesAsync(
            Guid tenantProfileId)
        {
            return await _context.SavedProperties
                .Where(s => s.TenantProfileId == tenantProfileId)
                .OrderByDescending(s => s.SavedAt)
                .ToListAsync();
        }

        public async Task<SavedProperty> SavePropertyAsync(
            Guid tenantProfileId,
            Guid propertyId)
        {
            var userExists = await _context.Users
                .AnyAsync(t => t.Id == tenantProfileId);

            if (!userExists)
            {
                throw new ArgumentException(
                    "User does not exist.");
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
            Guid tenantProfileId,
            Guid propertyId)
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
