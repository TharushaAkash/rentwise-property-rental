using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using RentWise.API.Common.Interfaces;
using RentWise.API.Modules.Maintenance.Entities;
using RentWise.API.Modules.Maintenance.Interfaces;
using ServiceProvider = RentWise.API.Modules.Maintenance.Entities.ServiceProvider;

namespace RentWise.API.Modules.Maintenance.Services
{
    public class ServiceProviderService : IServiceProviderService
    {
        private readonly IRepository<ServiceProvider> _repository;

        public ServiceProviderService(IRepository<ServiceProvider> repository)
        {
            _repository = repository;
        }

        public async Task<IEnumerable<ServiceProvider>> GetAllProvidersAsync()
        {
            return await _repository.GetAllAsync();
        }

        public async Task<ServiceProvider?> GetProviderByIdAsync(Guid id)
        {
            return await _repository.GetByIdAsync(id);
        }

        public async Task<ServiceProvider> CreateProviderAsync(ServiceProvider provider)
        {
            return await _repository.AddAsync(provider);
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
