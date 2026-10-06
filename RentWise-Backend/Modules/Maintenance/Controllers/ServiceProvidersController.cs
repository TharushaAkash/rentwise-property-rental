using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RentWise.API.Data;
using RentWise.API.Modules.Maintenance.Interfaces;
using ServiceProvider = RentWise.API.Modules.Maintenance.Entities.ServiceProvider;

namespace RentWise.API.Modules.Maintenance.Controllers;

[ApiController, Route("api/service-providers"), Authorize]
public class ServiceProvidersController(IServiceProviderService service, ApplicationDbContext db) : ControllerBase
{
    private Guid? Actor => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var id) ? id : null;
    private bool Admin => User.IsInRole("Admin") || User.IsInRole("Administrator") || User.IsInRole("SystemAdmin");
    private IQueryable<ServiceProvider> VisibleProviders() => db.ServiceProviders.Where(sp => Admin ||
        (sp.OwnerId != null && (sp.OwnerId == Actor || (User.IsInRole("Tenant") &&
            (db.RentalAgreements.Any(a => a.TenantId == Actor && a.OwnerId == sp.OwnerId) ||
             db.PropertyApplications.Any(a => a.TenantId == Actor && a.Property.OwnerId == sp.OwnerId &&
                (a.Status == "Submitted" || a.Status == "Accepted")) ||
             db.MaintenanceRequests.Any(r => r.TenantId == Actor && r.Property.OwnerId == sp.OwnerId))))));

    [HttpGet]
    public async Task<IActionResult> GetProviders()
    {
        if (Actor == null) return Forbid();
        return Ok(await VisibleProviders().AsNoTracking().ToListAsync());
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetProvider(Guid id)
    {
        if (Actor == null) return Forbid();
        var result = await VisibleProviders().AsNoTracking().SingleOrDefaultAsync(p => p.Id == id);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost, Authorize(Roles = "Owner,PropertyOwner,Admin,Administrator,SystemAdmin")]
    public async Task<IActionResult> CreateProvider([FromBody] ServiceProvider provider)
    {
        if (Actor == null) return Forbid();
        provider.OwnerId = Actor.Value;
        var created = await service.CreateProviderAsync(provider);
        return CreatedAtAction(nameof(GetProvider), new { id = created.Id }, created);
    }

    [HttpPut("{id}"), Authorize(Roles = "Owner,PropertyOwner,Admin,Administrator,SystemAdmin")]
    public async Task<IActionResult> UpdateProvider(Guid id, [FromBody] ServiceProvider provider)
    {
        if (id != provider.Id) return BadRequest();
        if (Actor == null) return Forbid();
        var existing = await db.ServiceProviders.AsNoTracking().SingleOrDefaultAsync(p => p.Id == id);
        if (existing == null) return NotFound();
        if (!Admin && existing.OwnerId != Actor) return Forbid();
        provider.OwnerId = existing.OwnerId;
        await service.UpdateProviderAsync(provider);
        return NoContent();
    }

    [HttpDelete("{id}"), Authorize(Roles = "Owner,PropertyOwner,Admin,Administrator,SystemAdmin")]
    public async Task<IActionResult> DeleteProvider(Guid id)
    {
        if (Actor == null) return Forbid();
        var existing = await db.ServiceProviders.FindAsync(id);
        if (existing == null) return NotFound();
        if (!Admin && existing.OwnerId != Actor) return Forbid();
        await service.DeleteProviderAsync(id);
        return NoContent();
    }
}
