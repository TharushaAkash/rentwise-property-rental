using System.Collections.Generic;
using System.Threading.Tasks;
using RentWise.API.Common.Interfaces;
using RentWise.API.Modules.Maintenance.Entities;
using RentWise.API.Modules.Maintenance.Interfaces;

namespace RentWise.API.Modules.Maintenance.Services
{
    public class MaintenanceRequestService : IMaintenanceRequestService
    {
        private readonly IRepository<MaintenanceRequest> _requestRepository;

        public MaintenanceRequestService(IRepository<MaintenanceRequest> requestRepository)
        {
            _requestRepository = requestRepository;
        }

        public async Task<IEnumerable<MaintenanceRequest>> GetAllRequestsAsync()
        {
            return await _requestRepository.GetAllAsync();
        }

        public async Task<MaintenanceRequest?> GetRequestByIdAsync(Guid id)
        {
            return await _requestRepository.GetByIdAsync(id);
        }

        public async Task<MaintenanceRequest> CreateRequestAsync(MaintenanceRequest request)
        {
            return await _requestRepository.AddAsync(request);
        }

        public async Task UpdateRequestAsync(MaintenanceRequest request)
        {
            await _requestRepository.UpdateAsync(request);
        }

        public async Task DeleteRequestAsync(Guid id)
        {
            var request = await _requestRepository.GetByIdAsync(id);
            if (request != null)
            {
                await _requestRepository.DeleteAsync(request);
            }
        }
    }
}
