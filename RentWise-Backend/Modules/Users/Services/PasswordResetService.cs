using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using RentWise.API.Data;
using RentWise.API.Modules.Users.DTOs;

namespace RentWise.API.Modules.Users.Services;

public sealed class PasswordResetException(string message, int statusCode = 400) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}

public sealed class PasswordResetService(ApplicationDbContext db, PasswordResetStore store,
    IPasswordResetEmailSender sender, TimeProvider clock)
{
    private static string Normalize(string email) => email.Trim().ToLowerInvariant();
    private static byte[] Hash(string value) => SHA256.HashData(Encoding.UTF8.GetBytes(value));

    public async Task<DateTimeOffset> SendAsync(string email)
    {
        email = Normalize(email);
        var gate = store.Gate(email);
        await gate.WaitAsync();
        try
        {
            var previous = store.Get(email);
            if (previous != null && previous.ExpiresAt > clock.GetUtcNow())
                throw new PasswordResetException("Please wait for the countdown to finish before requesting another code.", 429);
            var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email.ToLower() == email);
            var code = RandomNumberGenerator.GetInt32(1000000).ToString("D6");
            // Replace any older OTP or reset token, including for unknown addresses.
            store.Remove(email);
            if (user != null && !user.IsBlocked) await sender.SendAsync(user.Email, code);
            var expiresAt = clock.GetUtcNow().AddMinutes(1);
            store.Put(email, new ResetChallenge
            {
                UserId = user?.IsBlocked == false ? user.Id : null,
                PasswordHash = user?.PasswordHash, CodeHash = Hash(code), ExpiresAt = expiresAt
            });
            return expiresAt;
        }
        finally { gate.Release(); }
    }

    public async Task<string> VerifyAsync(VerifyPasswordOtpDto dto)
    {
        var email = Normalize(dto.Email);
        var gate = store.Gate(email);
        await gate.WaitAsync();
        try
        {
            var challenge = store.Get(email);
            if (challenge == null || challenge.ExpiresAt <= clock.GetUtcNow() || challenge.Attempts >= 5 || challenge.TokenHash != null)
                throw new PasswordResetException("Code expired or unavailable. Please request a new code.");
            challenge.Attempts++;
            if (!CryptographicOperations.FixedTimeEquals(challenge.CodeHash, Hash(dto.Code)) || challenge.UserId == null)
                throw new PasswordResetException(challenge.Attempts >= 5 ? "Too many incorrect attempts. Wait for the timer and request a new code." : "Incorrect code. Please try again.");
            var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
            challenge.TokenHash = Hash(token);
            challenge.TokenExpiresAt = clock.GetUtcNow().AddMinutes(10);
            return token;
        }
        finally { gate.Release(); }
    }

    public async Task ResetAsync(ResetPasswordDto dto)
    {
        var email = Normalize(dto.Email);
        var gate = store.Gate(email);
        await gate.WaitAsync();
        try
        {
            var challenge = store.Get(email);
            if (challenge?.TokenHash == null || challenge.TokenExpiresAt <= clock.GetUtcNow() ||
                !CryptographicOperations.FixedTimeEquals(challenge.TokenHash, Hash(dto.ResetToken)))
                throw new PasswordResetException("Your reset session expired. Please request a new code.");
            var user = await db.Users.FindAsync(challenge.UserId);
            if (user == null || user.IsBlocked || user.PasswordHash != challenge.PasswordHash)
                throw new PasswordResetException("Your reset session is no longer valid. Please start again.");
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
            user.UpdatedAt = clock.GetUtcNow().UtcDateTime;
            await db.SaveChangesAsync();
            store.Remove(email);
        }
        finally { gate.Release(); }
    }
}
