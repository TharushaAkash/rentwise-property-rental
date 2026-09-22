using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using RentWise.API.Modules.Maintenance.Entities;

namespace RentWise.API.Modules.Maintenance.Interfaces
{
    public interface IRequestStatusLogService
    {
        Task<IEnumerable<RequestStatusLog>> GetAllLogsAsync(Guid requestId);
        Task<RequestStatusLog?> GetLogByIdAsync(Guid id);
        Task<RequestStatusLog> CreateLogAsync(RequestStatusLog log);
        Task UpdateLogAsync(RequestStatusLog log);
        Task DeleteLogAsync(Guid id);
    }
}
