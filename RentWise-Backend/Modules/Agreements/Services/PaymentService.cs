using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using RentWise.API.Common.Interfaces;
using RentWise.API.Modules.Agreements.Entities;
using RentWise.API.Modules.Agreements.Interfaces;

namespace RentWise.API.Modules.Agreements.Services
{
    public class PaymentService : IPaymentService
    {
        private readonly IRepository<Payment> _repository;

        public PaymentService(IRepository<Payment> repository)
        {
            _repository = repository;
        }

        public async Task<IEnumerable<Payment>> GetAllPaymentsAsync(Guid rentalAgreementId)
        {
            return await _repository.GetAllAsync();
        }

        public async Task<Payment?> GetPaymentByIdAsync(Guid id)
        {
            return await _repository.GetByIdAsync(id);
        }

        public async Task<Payment> CreatePaymentAsync(Payment payment)
        {
            return await _repository.AddAsync(payment);
        }

        public async Task UpdatePaymentAsync(Payment payment)
        {
            await _repository.UpdateAsync(payment);
        }

        public async Task DeletePaymentAsync(Guid id)
        {
            var entity = await _repository.GetByIdAsync(id);
            if (entity != null)
            {
                await _repository.DeleteAsync(entity);
            }
        }
    }
}
