using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RentWise_Backend.Models;
using RentWise_Backend.Data;
using System;
using System.Threading.Tasks;

namespace RentWise_Backend.Controllers
{
    [Route("api/agreements")]
    [ApiController]
    public class AgreementController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AgreementController(AppDbContext context)
        {
            _context = context;
        }

        // POST: /api/agreements/draft
        // Business-specific: triggers the Agreement & Pricing Agent
        [HttpPost("draft")]
        public IActionResult DraftAgreement([FromBody] object draftRequest)
        {
            // TODO: Call the Agentic AI Python service here
            return Ok(new { message = "Agentic AI triggered to draft agreement." });
        }

        // GET: /api/agreements/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetAgreement(Guid id)
        {
            var agreement = await _context.RentalAgreements.FindAsync(id);
            if (agreement == null) return NotFound();
            return Ok(agreement);
        }

        // PUT: /api/agreements/{id}/decision
        // Handles Owner approval, rejection, or revision requests
        [HttpPut("{id}/decision")]
        public async Task<IActionResult> OwnerDecision(Guid id, [FromBody] string decision)
        {
            var agreement = await _context.RentalAgreements.FindAsync(id);
            if (agreement == null) return NotFound();

            // Apply state transition logic (e.g., Pending Owner Approval -> Active)
            agreement.Status = decision;
            agreement.UpdatedAt = DateTime.UtcNow;
            
            await _context.SaveChangesAsync();
            return Ok(new { message = $"Agreement {id} status updated to {decision}." });
        }
    }
}