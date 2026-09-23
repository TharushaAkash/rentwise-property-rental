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

        public AuthController(IAuthService authService, ApplicationDbContext context)
        {
            _authService = authService;
            _context = context;
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

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();

            return Ok(new { message = "User successfully deleted." });
        }
    }
}
