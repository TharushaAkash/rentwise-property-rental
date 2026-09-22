using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using RentWise.API.Common.Interfaces;
using RentWise.API.Modules.Agreements.Entities;
using RentWise.API.Modules.Agreements.Interfaces;

namespace RentWise.API.Modules.Agreements.Services
{
    public class RentReminderService : IRentReminderService
    {
        private readonly IRepository<RentReminder> _repository;

        public RentReminderService(IRepository<RentReminder> repository)
        {
            _repository = repository;
        }

        public async Task<IEnumerable<RentReminder>> GetAllRemindersAsync(Guid rentalAgreementId)
        {
            return await _repository.GetAllAsync();
        }

        public async Task<RentReminder?> GetReminderByIdAsync(Guid id)
        {
            return await _repository.GetByIdAsync(id);
        }

        public async Task<RentReminder> CreateReminderAsync(RentReminder reminder)
        {
            return await _repository.AddAsync(reminder);
        }

        public async Task UpdateReminderAsync(RentReminder reminder)
        {
            await _repository.UpdateAsync(reminder);
        }

        public async Task DeleteReminderAsync(Guid id)
        {
            var entity = await _repository.GetByIdAsync(id);
            if (entity != null)
            {
                await _repository.DeleteAsync(entity);
            }
        }
    }
}
