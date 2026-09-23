using System.Collections.Generic;
using System.Threading.Tasks;
using RentWise.API.Modules.Maintenance.Entities;

namespace RentWise.API.Modules.Maintenance.Interfaces
{
    public interface IMaintenanceRequestService
    {
        Task<IEnumerable<MaintenanceRequest>> GetAllRequestsAsync();
        Task<MaintenanceRequest?> GetRequestByIdAsync(Guid id);
        Task<MaintenanceRequest> CreateRequestAsync(MaintenanceRequest request);
        Task UpdateRequestAsync(MaintenanceRequest request);
        Task DeleteRequestAsync(Guid id);
    }
}
