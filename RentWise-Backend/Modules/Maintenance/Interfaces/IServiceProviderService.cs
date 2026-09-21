using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using RentWise_Backend.Modules.Maintenance.Entities;
using ServiceProvider = RentWise_Backend.Modules.Maintenance.Entities.ServiceProvider;

namespace RentWise_Backend.Modules.Maintenance.Interfaces
{
    public interface IServiceProviderService
    {
        Task<IEnumerable<ServiceProvider>> GetAllProvidersAsync(Guid? ownerId = null);
        Task<ServiceProvider?> GetProviderByIdAsync(Guid id);
        Task<ServiceProvider> CreateProviderAsync(ServiceProvider provider);
        Task UpdateProviderAsync(ServiceProvider provider);
        Task DeleteProviderAsync(Guid id);
    }
}
