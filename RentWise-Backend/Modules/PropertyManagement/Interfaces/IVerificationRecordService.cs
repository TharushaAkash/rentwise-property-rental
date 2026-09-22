using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using RentWise.API.Modules.PropertyManagement.Entities;

namespace RentWise.API.Modules.PropertyManagement.Interfaces
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
