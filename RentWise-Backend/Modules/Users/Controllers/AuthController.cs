using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RentWise.API.Data;
using RentWise.API.Modules.Users.DTOs;
using RentWise.API.Modules.Users.Services;

namespace RentWise.API.Modules.Users.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;
        private readonly ApplicationDbContext _context;
        private readonly RentWise.API.Common.Interfaces.ISupabaseStorageService _storageService;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;

        public AuthController(
            IAuthService authService, 
            ApplicationDbContext context, 
            RentWise.API.Common.Interfaces.ISupabaseStorageService storageService,
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration)
        {
            _authService = authService;
            _context = context;
            _storageService = storageService;
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var result = await _authService.RegisterAsync(dto);
                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred during registration.", error = ex.Message });
            }
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var result = await _authService.LoginAsync(dto);
                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred during login.", error = ex.Message });
            }
        }

        [Authorize]
        [HttpGet("profile")]
        public async Task<IActionResult> GetProfile()
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
                         ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                         ?? User.FindFirst("sub")?.Value;

            if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
            {
                return Unauthorized(new { message = "User not authenticated or invalid token." });
            }

            try
            {
                var profile = await _authService.GetProfileAsync(userId);
                return Ok(profile);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to load profile.", error = ex.Message });
            }
        }

        [Authorize]
        [HttpPut("profile")]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
                         ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                         ?? User.FindFirst("sub")?.Value;

            if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
            {
                return Unauthorized(new { message = "User not authenticated or invalid token." });
            }

            try
            {
                var result = await _authService.UpdateProfileAsync(userId, dto);
                return Ok(result);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to update profile.", error = ex.Message });
            }
        }

        [Authorize]
        [HttpPost("change-password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
                         ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                         ?? User.FindFirst("sub")?.Value;

            if (string.IsNullOrEmpty(userIdStr) || !Guid.TryParse(userIdStr, out var userId))
            {
                return Unauthorized(new { message = "User not authenticated or invalid token." });
            }

            try
            {
                await _authService.ChangePasswordAsync(userId, dto);
                return Ok(new { message = "Password changed successfully!" });
            }
            catch (UnauthorizedAccessException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to change password.", error = ex.Message });
            }
        }

        [AllowAnonymous]
        [HttpGet("users/{userId}")]
        public async Task<IActionResult> GetUserPublic(Guid userId)
        {
            try
            {
                var profile = await _authService.GetProfileAsync(userId);
                return Ok(new 
                {
                    id = profile.Id,
                    name = profile.Name,
                    fullName = profile.FullName,
                    email = profile.Email,
                    phoneNumber = profile.PhoneNumber,
                    role = profile.Role
                });
            }
            catch (KeyNotFoundException)
            {
                return NotFound(new { message = "User not found." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to load user details.", error = ex.Message });
            }
        }

        [Authorize(Roles = "Administrator,Admin,SystemAdmin")]
        [HttpGet("users")]
        public async Task<IActionResult> GetAllUsers()
        {
            try
            {
                var users = await _context.Users
                    .OrderByDescending(u => u.CreatedAt)
                    .Select(u => new
                    {
                        id = u.Id,
                        name = u.Name,
                        fullName = u.Name,
                        email = u.Email,
                        role = u.Role,
                        phoneNumber = u.PhoneNumber,
                        nicNumber = u.NicNumber,
                        isBlocked = u.IsBlocked,
                        createdAt = u.CreatedAt
                    })
                    .ToListAsync();

                return Ok(users);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to load users.", error = ex.Message });
            }
        }

        [Authorize(Roles = "Administrator,Admin,SystemAdmin")]
        [HttpPut("users/{userId}/block")]
        [HttpPost("users/{userId}/block")]
        public async Task<IActionResult> ToggleBlockUser(Guid userId, [FromBody] BlockUserDto? dto = null)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound(new { message = "User not found." });

            var currentUserIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (Guid.TryParse(currentUserIdStr, out var currentUserId) && currentUserId == userId)
            {
                return BadRequest(new { message = "Administrator cannot block their own account." });
            }

            user.IsBlocked = dto?.IsBlocked ?? !user.IsBlocked;
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var actionDesc = user.IsBlocked ? "blocked" : "unblocked";
            return Ok(new 
            { 
                message = $"User {user.Name} has been {actionDesc}.", 
                user = new { user.Id, user.Name, user.Email, user.Role, user.IsBlocked } 
            });
        }

        [Authorize(Roles = "Administrator,Admin,SystemAdmin")]
        [HttpPut("users/{userId}/role")]
        public async Task<IActionResult> UpdateUserRole(Guid userId, [FromBody] UpdateRoleDto dto)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound(new { message = "User not found." });

            if (string.IsNullOrWhiteSpace(dto.Role))
            {
                return BadRequest(new { message = "Role cannot be empty." });
            }

            user.Role = dto.Role.Trim();
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { message = $"User role updated to {user.Role}.", user = new { user.Id, user.Name, user.Email, user.Role } });
        }
        [HttpPost("{id}/verify-nic")]
        [Authorize]
        [RequestSizeLimit(12 * 1024 * 1024)]
        public async Task<IActionResult> VerifyNic(Guid id, [FromForm] IFormFile file)
        {
            var actor = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            var admin = User.IsInRole("Administrator") || User.IsInRole("Admin") || User.IsInRole("SystemAdmin");
            if (!Guid.TryParse(actor, out var actorId) || (actorId != id && !admin)) return Forbid();
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { message = "User not found." });
            if (string.IsNullOrWhiteSpace(user.NicNumber)) return BadRequest(new { message = "Add your NIC number to your profile before uploading." });
            if (file == null || file.Length == 0 || file.Length > 10 * 1024 * 1024)
                return BadRequest(new { message = "Choose a NIC image smaller than 10 MB." });
            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!new[] { ".jpg", ".jpeg", ".png", ".webp" }.Contains(extension) || !file.ContentType.StartsWith("image/"))
                return BadRequest(new { message = "Upload a JPG, PNG or WebP image." });
            string imageUrl;
            try
            {
                imageUrl = await _storageService.UploadFileAsync(file, "NICs", $"nic_{id}_{Guid.NewGuid():N}{extension}");
                user.NicImageUrl = imageUrl;
                user.IsNicVerified = false;
                user.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
            catch
            {
                return StatusCode(503, new { message = "NIC upload failed. Please retry or contact support if storage is unavailable." });
            }
            var nicNumber = user.NicNumber;
            var message = "NIC image uploaded. Verification is unavailable; please retry later.";
            var verified = false;
            try
            {
                var workflowKey = Environment.GetEnvironmentVariable("AGENT_WORKFLOW_KEY") ?? _configuration["AgentWorkflowKey"];
                if (!string.IsNullOrWhiteSpace(workflowKey))
                {
                    var client = _httpClientFactory.CreateClient();
                    client.Timeout = TimeSpan.FromSeconds(60);
                    client.DefaultRequestHeaders.Add("X-Workflow-Key", workflowKey);
                    var agentUrl = Environment.GetEnvironmentVariable("AgenticServiceUrl") ?? _configuration["AgenticServiceUrl"] ?? "https://rentwise-ai-service.onrender.com";
                    var response = await client.PostAsJsonAsync($"{agentUrl.TrimEnd('/')}/workflow/verify-nic", new { nic_number = nicNumber, image_url = imageUrl });
                    if (response.IsSuccessStatusCode)
                    {
                        var result = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
                        verified = result.TryGetProperty("isVerified", out var value) && value.ValueKind == System.Text.Json.JsonValueKind.True;
                        message = verified ? "Your NIC is verified." : "NIC image uploaded, but verification failed. Choose a clear image matching your profile NIC number.";
                    }
                }
            }
            catch (HttpRequestException) { }
            catch (TaskCanceledException) { }
            catch (System.Text.Json.JsonException) { }
            await _context.Entry(user).ReloadAsync();
            if (user.NicNumber != nicNumber || user.NicImageUrl != imageUrl)
                return Conflict(new { message = "Your NIC details changed during verification. Upload the matching image again." });
            user.IsNicVerified = verified;
            user.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(new { message, isNicVerified = user.IsNicVerified, nicImageUrl = user.NicImageUrl });
        }


        [Authorize(Roles = "Administrator,Admin,SystemAdmin")]
        [HttpDelete("users/{userId}")]
        public async Task<IActionResult> DeleteUser(Guid userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound(new { message = "User not found." });

            var currentUserIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (Guid.TryParse(currentUserIdStr, out var currentUserId) && currentUserId == userId)
            {
                return BadRequest(new { message = "Administrator cannot delete their own account." });
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // Booking references restrict both user and property deletion.
                var ownedPropertyIds = await _context.Properties.Where(p => p.OwnerId == userId)
                    .Select(p => p.Id).ToListAsync();
                var bookings = await _context.PropertyApplications.Where(a =>
                    a.TenantId == userId || ownedPropertyIds.Contains(a.PropertyId)).ToListAsync();
                _context.PropertyApplications.RemoveRange(bookings);
                var savedProperties = await _context.SavedProperties.Where(s =>
                    s.TenantProfileId == userId || ownedPropertyIds.Contains(s.PropertyId)).ToListAsync();
                _context.SavedProperties.RemoveRange(savedProperties);
                var documentReviews = await _context.DocumentReviewRequests.Where(r =>
                    ownedPropertyIds.Contains(r.PropertyId)).ToListAsync();
                _context.DocumentReviewRequests.RemoveRange(documentReviews);

                // Keep other owners' verification history when deleting its administrator.
                var adminVerifications = await _context.VerificationRecords.Where(v => v.AdminId == userId).ToListAsync();
                foreach (var verification in adminVerifications) verification.AdminId = null;

                // 1. Maintenance Requests (as tenant)
                var maintenanceReqs = await _context.MaintenanceRequests.Where(m => m.TenantId == userId).ToListAsync();
                foreach (var req in maintenanceReqs)
                {
                    var logs = await _context.RequestStatusLogs.Where(l => l.MaintenanceRequestId == req.Id).ToListAsync();
                    _context.RequestStatusLogs.RemoveRange(logs);
                }
                _context.MaintenanceRequests.RemoveRange(maintenanceReqs);

                // 2. Rental Agreements (as tenant or owner)
                var agreements = await _context.RentalAgreements.Where(a => a.TenantId == userId || a.OwnerId == userId).ToListAsync();
                foreach (var agreement in agreements)
                {
                    var payments = await _context.Payments.Where(p => p.RentalAgreementId == agreement.Id).ToListAsync();
                    var reminders = await _context.RentReminders.Where(r => r.RentalAgreementId == agreement.Id).ToListAsync();
                    _context.Payments.RemoveRange(payments);
                    _context.RentReminders.RemoveRange(reminders);
                }
                _context.RentalAgreements.RemoveRange(agreements);

                // 3. Properties (as owner) and their related data
                var properties = await _context.Properties.Where(p => p.OwnerId == userId).ToListAsync();
                foreach (var property in properties)
                {
                    // Property-related Maintenance Requests
                    var propMaintenanceReqs = await _context.MaintenanceRequests.Where(m => m.PropertyId == property.Id).ToListAsync();
                    foreach (var mReq in propMaintenanceReqs)
                    {
                        var logs = await _context.RequestStatusLogs.Where(l => l.MaintenanceRequestId == mReq.Id).ToListAsync();
                        _context.RequestStatusLogs.RemoveRange(logs);
                    }
                    _context.MaintenanceRequests.RemoveRange(propMaintenanceReqs);

                    // Property-related Agreements (just in case they weren't caught by OwnerId)
                    var propAgreements = await _context.RentalAgreements.Where(a => a.PropertyId == property.Id).ToListAsync();
                    foreach (var a in propAgreements)
                    {
                        var payments = await _context.Payments.Where(p => p.RentalAgreementId == a.Id).ToListAsync();
                        var reminders = await _context.RentReminders.Where(r => r.RentalAgreementId == a.Id).ToListAsync();
                        _context.Payments.RemoveRange(payments);
                        _context.RentReminders.RemoveRange(reminders);
                    }
                    _context.RentalAgreements.RemoveRange(propAgreements);

                    // Photos, Docs, Verifications
                    var photos = await _context.PropertyPhotos.Where(p => p.PropertyId == property.Id).ToListAsync();
                    var docs = await _context.PropertyDocuments.Where(d => d.PropertyId == property.Id).ToListAsync();
                    var verifications = await _context.VerificationRecords.Where(v => v.PropertyId == property.Id).ToListAsync();
                    
                    _context.PropertyPhotos.RemoveRange(photos);
                    _context.PropertyDocuments.RemoveRange(docs);
                    _context.VerificationRecords.RemoveRange(verifications);
                }
                _context.Properties.RemoveRange(properties);

                // 4. Finally, delete the User
                _context.Users.Remove(user);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new { message = "User and all related data successfully deleted." });
            }
            catch (DbUpdateException)
            {
                await transaction.RollbackAsync();
                return Conflict(new { message = "User deletion was blocked by related records. No changes were saved. Review the account's linked records before retrying." });
            }
            catch (Exception)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "Failed to delete user. No changes were saved." });
            }
        }
    }
}
