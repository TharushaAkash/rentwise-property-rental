using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RentWise_Backend.Models;
using RentWise_Backend.Data;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace RentWise_Backend.Controllers
{
    // Routes to /api/agreements/{agreementId}/payments
    [Route("api/agreements/{agreementId}/payments")]
    [ApiController]
    public class PaymentController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PaymentController(AppDbContext context)
        {
            _context = context;
        }

        // GET: /api/agreements/{agreementId}/payments
        [HttpGet]
        public async Task<IActionResult> GetPaymentHistory(Guid agreementId)
        {
            var payments = await _context.Payments
                .Where(p => p.RentalAgreementId == agreementId)
                .ToListAsync();
                
            return Ok(payments);
        }

        // POST: /api/agreements/{agreementId}/payments
        [HttpPost]
        public async Task<IActionResult> MakePayment(Guid agreementId, [FromBody] Payment payment)
        {
            // Link the payment to the agreement ID from the URL
            payment.RentalAgreementId = agreementId;
            payment.CreatedAt = DateTime.UtcNow;
            
            _context.Payments.Add(payment);
            await _context.SaveChangesAsync();
            
            return Ok(payment);
        }
    }
}