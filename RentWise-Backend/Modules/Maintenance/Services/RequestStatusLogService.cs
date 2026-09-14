using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using RentWise.API.Common.Interfaces;
using RentWise.API.Modules.Maintenance.Entities;
using RentWise.API.Modules.Maintenance.Interfaces;

namespace RentWise.API.Modules.Maintenance.Services
{
    public class RequestStatusLogService : IRequestStatusLogService
    {
        private readonly IRepository<RequestStatusLog> _repository;

        public RequestStatusLogService(IRepository<RequestStatusLog> repository)
        {
            _repository = repository;
        }

        public async Task<IEnumerable<RequestStatusLog>> GetAllLogsAsync(Guid requestId)
        {
            return await _repository.GetAllAsync();
        }

        public async Task<RequestStatusLog?> GetLogByIdAsync(Guid id)
        {
            return await _repository.GetByIdAsync(id);
        }

        public async Task<RequestStatusLog> CreateLogAsync(RequestStatusLog log)
        {
            return await _repository.AddAsync(log);
        }

        public async Task UpdateLogAsync(RequestStatusLog log)
        {
            await _repository.UpdateAsync(log);
        }

        public async Task DeleteLogAsync(Guid id)
        {
            var entity = await _repository.GetByIdAsync(id);
            if (entity != null)
            {
                await _repository.DeleteAsync(entity);
            }
        }
    }
}
