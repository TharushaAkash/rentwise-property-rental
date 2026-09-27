using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentWise.API.Modules.Agreements.Entities;
using RentWise.API.Modules.Agreements.Interfaces;

namespace RentWise.API.Modules.Agreements.Controllers
{
    [ApiController]
    [Route("api/agreements/{agreementId}/payments")]
    [Authorize]
    public class PaymentsController : ControllerBase
    {
        private readonly IPaymentService _service;

        public PaymentsController(IPaymentService service)
        {
            _service = service;
        }



        [HttpGet("{id}")]
        public async Task<IActionResult> GetPayment(Guid agreementId, Guid id)
        {
            var result = await _service.GetPaymentByIdAsync(id);
            if (result == null || result.RentalAgreementId != agreementId) return NotFound();
            return Ok(result);
        }

        [HttpPost]
        [Authorize(Roles = "Tenant")]
        public async Task<IActionResult> CreatePayment(Guid agreementId, [FromBody] Payment payment)
        {
            payment.RentalAgreementId = agreementId;
            try
            {
                var created = await _service.CreatePaymentAsync(payment);
                return CreatedAtAction(nameof(GetPayment), new { agreementId = agreementId, id = created.Id }, created);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Tenant")]
        public async Task<IActionResult> UpdatePayment(Guid agreementId, Guid id, [FromBody] Payment payment)
        {
            if (id != payment.Id || agreementId != payment.RentalAgreementId) return BadRequest();
            await _service.UpdatePaymentAsync(payment);
            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "SystemAdmin")] // Typically only admins can delete payments
        public async Task<IActionResult> DeletePayment(Guid agreementId, Guid id)
        {
            await _service.DeletePaymentAsync(id);
            return NoContent();
        }
    }
}
