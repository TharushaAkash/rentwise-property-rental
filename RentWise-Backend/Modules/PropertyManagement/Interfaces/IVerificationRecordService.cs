using RentWise_Backend.Models.PropertyManagement;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace RentWise_Backend.Services.Interfaces
{
    public interface IVerificationRecordService
    {
        Task<IEnumerable<VerificationRecord>> GetAllRecordsAsync(Guid propertyId);
        Task<VerificationRecord?> GetRecordByIdAsync(Guid id);
        Task<VerificationRecord> CreateRecordAsync(VerificationRecord record);
        Task UpdateRecordAsync(VerificationRecord record);
        Task DeleteRecordAsync(Guid id);
    }
}
