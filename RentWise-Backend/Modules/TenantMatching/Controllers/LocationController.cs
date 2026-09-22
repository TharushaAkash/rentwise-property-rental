using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentWise_Backend.Modules.TenantMatching.Interfaces;

namespace RentWise_Backend.Modules.TenantMatching.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class LocationController : ControllerBase
    {
        private readonly ILocationService _locationService;

        public LocationController(ILocationService locationService)
        {
            _locationService = locationService;
        }

        [HttpGet("distance")]
        // Accessible without auth token to allow Python Agent to query easily, or we can use the Agent API Key if implemented
        public async Task<IActionResult> GetDistance([FromQuery] string origin, [FromQuery] string destination)
        {
            if (string.IsNullOrWhiteSpace(origin) || string.IsNullOrWhiteSpace(destination))
            {
                return BadRequest("Origin and destination must be provided.");
            }

            var (distanceKm, timeMins) = await _locationService.GetDistanceAndTravelTimeAsync(origin, destination);
            
            return Ok(new
            {
                origin,
                destination,
                distanceKm,
                travelTimeMinutes = timeMins
            });
        }
    }
}
