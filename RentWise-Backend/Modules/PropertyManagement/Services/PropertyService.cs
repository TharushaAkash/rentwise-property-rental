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

        public async Task<RentWise_Backend.Modules.PropertyManagement.DTOs.MarketRentDto> GetMarketRentAsync(string location, string propertyType, int bedrooms)
        {
            var query = _context.Properties
                .Where(p => p.Status == PropertyStatus.Active);

            if (!string.IsNullOrEmpty(location))
                query = query.Where(p => p.Address.ToLower().Contains(location.ToLower()));
                
            if (!string.IsNullOrEmpty(propertyType))
                query = query.Where(p => p.PropertyType.ToLower() == propertyType.ToLower());
                
            if (bedrooms > 0)
                query = query.Where(p => p.Bedrooms == bedrooms);

            var count = await query.CountAsync();
            if (count == 0)
            {
                return new RentWise_Backend.Modules.PropertyManagement.DTOs.MarketRentDto
                {
                    AverageRent = 0,
                    MinRent = 0,
                    MaxRent = 0,
                    PropertyCount = 0
                };
            }

            var avg = await query.AverageAsync(p => p.MonthlyRent);
            var min = await query.MinAsync(p => p.MonthlyRent);
            var max = await query.MaxAsync(p => p.MonthlyRent);

            return new RentWise_Backend.Modules.PropertyManagement.DTOs.MarketRentDto
            {
                AverageRent = avg,
                MinRent = min,
                MaxRent = max,
                PropertyCount = count
            };
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

        public async Task<bool> UpdatePropertyStatusAsync(Guid id, PropertyStatus newStatus)
        {
            var property = await _context.Properties.FindAsync(id);
            if (property == null) return false;

            property.Status = newStatus;
            property.UpdatedAt = DateTime.UtcNow;
            
            _context.Properties.Update(property);
            await _context.SaveChangesAsync();
            return true;
        }
    }
}
