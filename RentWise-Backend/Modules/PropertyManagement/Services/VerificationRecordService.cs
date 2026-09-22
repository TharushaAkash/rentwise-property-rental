using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RentWise.API.Data;
using RentWise.API.Modules.PropertyManagement.Entities;
using RentWise.API.Modules.PropertyManagement.Interfaces;

namespace RentWise.API.Modules.PropertyManagement.Services
{
    public class VerificationRecordService : IVerificationRecordService
    {
        private readonly ApplicationDbContext _context;

        public VerificationRecordService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<VerificationRecord>> GetAllRecordsAsync(Guid propertyId)
        {
            return await _context.VerificationRecords
                .Where(r => r.PropertyId == propertyId)
                .ToListAsync();
        }

        public async Task<VerificationRecord?> GetRecordByIdAsync(Guid id)
        {
            return await _context.VerificationRecords.FindAsync(id);
        }

        public async Task<VerificationRecord> CreateRecordAsync(VerificationRecord record)
        {
            _context.VerificationRecords.Add(record);
            await _context.SaveChangesAsync();
            return record;
        }

        public async Task UpdateRecordAsync(VerificationRecord record)
        {
            _context.Entry(record).State = EntityState.Modified;
            await _context.SaveChangesAsync();
        }

        public async Task DeleteRecordAsync(Guid id)
        {
            var record = await _context.VerificationRecords.FindAsync(id);
            if (record != null)
            {
                _context.VerificationRecords.Remove(record);
                await _context.SaveChangesAsync();
            }
        }
    }
}

