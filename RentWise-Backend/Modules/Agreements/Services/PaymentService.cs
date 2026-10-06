using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using RentWise.API.Common.Interfaces;
using RentWise.API.Modules.Agreements.Entities;
using RentWise.API.Modules.Agreements.Interfaces;
using Microsoft.EntityFrameworkCore;
using RentWise.API.Data;

namespace RentWise.API.Modules.Agreements.Services
{
    public class PaymentService : IPaymentService
    {
        private readonly IRepository<Payment> _repository;
        private readonly ApplicationDbContext _context;
        private readonly IBookingConfirmationEmailSender _email;
        private readonly ILogger<PaymentService> _logger;

        public PaymentService(IRepository<Payment> repository, ApplicationDbContext context,
            IBookingConfirmationEmailSender email, ILogger<PaymentService> logger)
        {
            _repository = repository;
            _context = context;
            _email = email;
            _logger = logger;
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
            var agreement = await _context.RentalAgreements
                .Include(a => a.Tenant).Include(a => a.Owner).Include(a => a.Property)
                .FirstOrDefaultAsync(a => a.Id == payment.RentalAgreementId)
                ?? throw new KeyNotFoundException("Rental agreement not found.");
            payment.ConfirmationEmailSent = null;
            if (payment.IsSuccessful) agreement.Status = AgreementStatus.Active;
            var created = await _repository.AddAsync(payment);
            if (created.IsSuccessful)
            {
                try
                {
                    await _email.SendAsync(agreement, created, payment.PaymentMethod);
                    created.ConfirmationEmailSent = true;
                }
                catch (Exception ex)
                {
                    created.ConfirmationEmailSent = false;
                    _logger.LogWarning("Booking email failed for payment {PaymentId} ({ErrorType}).", created.Id, ex.GetType().Name);
                }
            }
            return created;
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
