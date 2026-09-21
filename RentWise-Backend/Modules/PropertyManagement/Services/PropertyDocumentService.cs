using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RentWise_Backend.Models.PropertyManagement;
using RentWise_Backend.Services.Interfaces;
using RentWise_Backend.Data;

namespace RentWise_Backend.Services
{
    public class PropertyDocumentService : IPropertyDocumentService
    {
        private readonly ApplicationDbContext _context;

        public PropertyDocumentService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<PropertyDocument>> GetAllDocumentsAsync(Guid propertyId)
        {
            return await _context.PropertyDocuments
                .Where(d => d.PropertyId == propertyId)
                .ToListAsync();
        }

        public async Task<PropertyDocument?> GetDocumentByIdAsync(Guid id)
        {
            return await _context.PropertyDocuments
                .FirstOrDefaultAsync(d => d.Id == id);
        }

        public async Task<PropertyDocument> CreateDocumentAsync(PropertyDocument document)
        {
            await _context.PropertyDocuments.AddAsync(document);
            await _context.SaveChangesAsync();
            return document;
        }

        public async Task UpdateDocumentAsync(PropertyDocument document)
        {
            _context.PropertyDocuments.Update(document);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteDocumentAsync(Guid id)
        {
            var document = await _context.PropertyDocuments.FindAsync(id);
            if (document != null)
            {
                _context.PropertyDocuments.Remove(document);
                await _context.SaveChangesAsync();
            }
        }
    }
}
