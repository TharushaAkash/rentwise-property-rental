using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using RentWise.API.Modules.Maintenance.Entities;
using ServiceProvider = RentWise.API.Modules.Maintenance.Entities.ServiceProvider;

namespace RentWise.API.Modules.Maintenance.Interfaces
{
    public interface IServiceProviderService
    {
        Task<IEnumerable<ServiceProvider>> GetAllProvidersAsync();
        Task<ServiceProvider?> GetProviderByIdAsync(Guid id);
        Task<ServiceProvider> CreateProviderAsync(ServiceProvider provider);
        Task UpdateProviderAsync(ServiceProvider provider);
        Task DeleteProviderAsync(Guid id);
    }
}
