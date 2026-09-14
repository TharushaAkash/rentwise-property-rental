using Microsoft.EntityFrameworkCore;
using RentWise_Backend.Services.Interfaces;
using RentWise_Backend.Data;
using RentWise_Backend.Models.PropertyManagement;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace RentWise_Backend.Services
{
    public class PropertyPhotoService : IPropertyPhotoService
    {
        private readonly ApplicationDbContext _context;

        public PropertyPhotoService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<PropertyPhoto>> GetAllPhotosAsync(Guid propertyId)
        {
            return await _context.PropertyPhotos
                .Where(p => p.PropertyId == propertyId)
                .ToListAsync();
        }

        public async Task<PropertyPhoto?> GetPhotoByIdAsync(Guid id)
        {
            return await _context.PropertyPhotos.FindAsync(id);
        }

        public async Task<PropertyPhoto> CreatePhotoAsync(PropertyPhoto photo)
        {
            _context.PropertyPhotos.Add(photo);
            await _context.SaveChangesAsync();
            return photo;
        }

        public async Task UpdatePhotoAsync(PropertyPhoto photo)
        {
            _context.Entry(photo).State = EntityState.Modified;
            await _context.SaveChangesAsync();
        }

        public async Task DeletePhotoAsync(Guid id)
        {
            var photo = await _context.PropertyPhotos.FindAsync(id);
            if (photo != null)
            {
                _context.PropertyPhotos.Remove(photo);
                await _context.SaveChangesAsync();
            }
        }
    }
}
