using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;

namespace RentWise_Backend.Controllers
{
    [ApiController]
    [Route("api/property-applications")]
    public class PropertyApplicationsController : ControllerBase
    {
        [HttpGet]
        public IActionResult GetApplications()
        {
            // Return an empty list for now to avoid the 404 error.
            // The frontend will automatically sync with local storage bookings.
            return Ok(new List<object>());
        }

        [HttpPost]
        public IActionResult CreateApplication([FromBody] object data)
        {
            return Ok(data);
        }

        [HttpPost("{id}/reject")]
        public IActionResult RejectApplication(string id)
        {
            return Ok(new { success = true, id });
        }

        [HttpPost("{id}/confirm")]
        public IActionResult ConfirmApplication(string id)
        {
            return Ok(new { success = true, id });
        }
    }
}
