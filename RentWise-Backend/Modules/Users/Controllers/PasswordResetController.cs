using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using RentWise.API.Modules.Users.DTOs;
using RentWise.API.Modules.Users.Services;

namespace RentWise.API.Modules.Users.Controllers;

[ApiController, AllowAnonymous, Route("api/auth"), EnableRateLimiting("password-reset")]
public sealed class PasswordResetController(PasswordResetService service, ILogger<PasswordResetController> logger) : ControllerBase
{
    [HttpPost("forgot-password")]
    public Task<IActionResult> Send(ForgotPasswordDto dto) => Execute(async () =>
        Ok(new { message = "If this email belongs to an active account, a verification code has been sent.", expiresAt = await service.SendAsync(dto.Email), expiresInSeconds = 60 }));

    [HttpPost("verify-reset-code")]
    public Task<IActionResult> Verify(VerifyPasswordOtpDto dto) => Execute(async () =>
        Ok(new { resetToken = await service.VerifyAsync(dto) }));

    [HttpPost("reset-password")]
    public Task<IActionResult> Reset(ResetPasswordDto dto) => Execute(async () =>
    {
        await service.ResetAsync(dto);
        return Ok(new { message = "Password reset successfully. You can now sign in." });
    });

    private async Task<IActionResult> Execute(Func<Task<IActionResult>> action)
    {
        Response.Headers.CacheControl = "no-store";
        try { return await action(); }
        catch (PasswordResetException ex) { return StatusCode(ex.StatusCode, new { message = ex.Message }); }
        catch (Exception ex)
        {
            logger.LogError("Password reset failed ({ErrorType}). Check the database and SMTP configuration.", ex.GetType().Name);
            return StatusCode(503, new { message = "Password reset is temporarily unavailable. Please try again shortly." });
        }
    }
}
