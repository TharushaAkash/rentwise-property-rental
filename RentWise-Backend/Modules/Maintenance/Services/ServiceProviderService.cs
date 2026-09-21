using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using RentWise_Backend.Common.Interfaces;
using RentWise_Backend.Modules.Maintenance.Entities;
using RentWise_Backend.Modules.Maintenance.Interfaces;
using ServiceProvider = RentWise_Backend.Modules.Maintenance.Entities.ServiceProvider;

namespace RentWise_Backend.Modules.Maintenance.Services
{
    public class ServiceProviderService : IServiceProviderService
    {
        private readonly IRepository<ServiceProvider> _repository;

        public ServiceProviderService(IRepository<ServiceProvider> repository)
        {
            _repository = repository;
        }

        public async Task<IEnumerable<ServiceProvider>> GetAllProvidersAsync(Guid? ownerId = null)
        {
            var providers = await _repository.GetAllAsync();
            if (ownerId.HasValue)
            {
                providers = providers.Where(p => p.OwnerId == ownerId.Value);
            }
            return providers;
        }

        public async Task<ServiceProvider?> GetProviderByIdAsync(Guid id)
        {
            return await _repository.GetByIdAsync(id);
        }

        public async Task<ServiceProvider> CreateProviderAsync(ServiceProvider provider)
        {
            var created = await _repository.AddAsync(provider);
            return created;
        }

        public async Task UpdateProviderAsync(ServiceProvider provider)
        {
            await _repository.UpdateAsync(provider);
        }

        public async Task DeleteProviderAsync(Guid id)
        {
            var entity = await _repository.GetByIdAsync(id);
            if (entity != null)
            {
                await _repository.DeleteAsync(entity);
            }
        }
    }
}
