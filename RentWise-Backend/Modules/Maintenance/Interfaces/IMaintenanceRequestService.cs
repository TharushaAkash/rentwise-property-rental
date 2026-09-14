using System.Collections.Generic;
using System.Threading.Tasks;
using RentWise_Backend.Models;

namespace RentWise_Backend.Services.Interfaces
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
