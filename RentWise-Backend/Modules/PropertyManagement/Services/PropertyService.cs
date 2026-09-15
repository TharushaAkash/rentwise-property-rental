using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RentWise_Backend.Models.PropertyManagement;
using RentWise_Backend.Services.Interfaces;
using RentWise_Backend.Data;

namespace RentWise_Backend.Services
{
    public class PropertyService : IPropertyService
    {
        private readonly ApplicationDbContext _context;

        public PropertyService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<Property>> GetAllPropertiesAsync()
        {
            return await _context.Properties
                .Include(p => p.Photos)
                .Include(p => p.Owner)
                .ToListAsync();
        }

        public async Task<Property?> GetPropertyByIdAsync(Guid id)
        {
            return await _context.Properties
                .Include(p => p.Photos)
                .Include(p => p.Owner)
                .FirstOrDefaultAsync(p => p.Id == id);
        }

        public async Task<IEnumerable<Property>> GetPropertiesByOwnerIdAsync(Guid ownerId)
        {
            return await _context.Properties
                .Where(p => p.OwnerId == ownerId)
                .Include(p => p.Photos)
                .Include(p => p.Owner)
                .ToListAsync();
        }

        public async Task<Property> CreatePropertyAsync(Property property)
        {
            await _context.Properties.AddAsync(property);
            await _context.SaveChangesAsync();
            return property;
        }

        public async Task UpdatePropertyAsync(Property property)
        {
            _context.Properties.Update(property);
            await _context.SaveChangesAsync();
        }

        public async Task DeletePropertyAsync(Guid id)
        {
            var property = await _context.Properties.FindAsync(id);
            if (property != null)
            {
                _context.Properties.Remove(property);
                await _context.SaveChangesAsync();
            }
        }
    }
}
