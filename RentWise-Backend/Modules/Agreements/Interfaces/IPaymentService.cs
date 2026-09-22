using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using RentWise.API.Modules.Agreements.Entities;

namespace RentWise.API.Modules.Agreements.Interfaces
{
    public interface IPaymentService
    {
        Task<IEnumerable<Payment>> GetAllPaymentsAsync(Guid rentalAgreementId);
        Task<Payment?> GetPaymentByIdAsync(Guid id);
        Task<Payment> CreatePaymentAsync(Payment payment);
        Task UpdatePaymentAsync(Payment payment);
        Task DeletePaymentAsync(Guid id);
    }
}
