using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using RentWise.API.Modules.Agreements.Entities;

namespace RentWise.API.Modules.Agreements.Interfaces
{
    public interface IRentReminderService
    {
        Task<IEnumerable<RentReminder>> GetAllRemindersAsync(Guid rentalAgreementId);
        Task<RentReminder?> GetReminderByIdAsync(Guid id);
        Task<RentReminder> CreateReminderAsync(RentReminder reminder);
        Task UpdateReminderAsync(RentReminder reminder);
        Task DeleteReminderAsync(Guid id);
    }
}
