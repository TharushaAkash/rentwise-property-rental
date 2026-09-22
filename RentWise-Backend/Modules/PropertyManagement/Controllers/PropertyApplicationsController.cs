using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;

namespace RentWise.API.Modules.PropertyManagement.Controllers
{
    [ApiController]
    [Route("api/property-applications")]
    public class PropertyApplicationsController : ControllerBase
    {
        // Thread-safe in-memory store so applications persist across API calls during runtime
        private static readonly ConcurrentDictionary<string, Dictionary<string, object>> _applications = new();

        [HttpGet]
        public IActionResult GetApplications()
        {
            var list = _applications.Values.OrderByDescending(a => 
                a.ContainsKey("createdAt") ? a["createdAt"].ToString() : string.Empty
            ).ToList();
            return Ok(list);
        }

        [HttpPost]
        public IActionResult CreateApplication([FromBody] JsonElement data)
        {
            try
            {
                var dict = JsonSerializer.Deserialize<Dictionary<string, object>>(data.GetRawText()) 
                           ?? new Dictionary<string, object>();

                string id = dict.ContainsKey("id") && dict["id"] != null && !string.IsNullOrWhiteSpace(dict["id"].ToString())
                    ? dict["id"].ToString()!
                    : $"app_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}_{Guid.NewGuid().ToString("N").Substring(0, 6)}";

                dict["id"] = id;
                if (!dict.ContainsKey("status"))
                {
                    dict["status"] = "Submitted";
                }
                if (!dict.ContainsKey("createdAt"))
                {
                    dict["createdAt"] = DateTime.UtcNow.ToString("o");
                }

                _applications[id] = dict;
                return Ok(dict);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = "Invalid application payload", error = ex.Message });
            }
        }

        [HttpPost("{id}/reject")]
        public IActionResult RejectApplication(string id)
        {
            if (_applications.TryGetValue(id, out var app))
            {
                app["status"] = "Rejected";
                app["updatedAt"] = DateTime.UtcNow.ToString("o");
                _applications[id] = app;
            }
            else
            {
                _applications[id] = new Dictionary<string, object>
                {
                    ["id"] = id,
                    ["status"] = "Rejected",
                    ["updatedAt"] = DateTime.UtcNow.ToString("o")
                };
            }
            return Ok(new { success = true, id, status = "Rejected" });
        }

        [HttpPost("{id}/confirm")]
        public IActionResult ConfirmApplication(string id)
        {
            if (_applications.TryGetValue(id, out var app))
            {
                app["status"] = "Accepted";
                app["updatedAt"] = DateTime.UtcNow.ToString("o");
                _applications[id] = app;
            }
            else
            {
                _applications[id] = new Dictionary<string, object>
                {
                    ["id"] = id,
                    ["status"] = "Accepted",
                    ["updatedAt"] = DateTime.UtcNow.ToString("o")
                };
            }
            return Ok(new { success = true, id, status = "Accepted" });
        }
    }
}
