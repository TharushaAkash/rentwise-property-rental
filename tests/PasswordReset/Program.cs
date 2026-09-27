using System.ComponentModel.DataAnnotations;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using RentWise.API.Data;
using RentWise.API.Modules.Users;
using RentWise.API.Modules.Users.DTOs;
using RentWise.API.Modules.Users.Services;

await using var connection = new SqliteConnection("Data Source=:memory:");
await connection.OpenAsync();
await using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(connection).Options);
await db.Database.ExecuteSqlRawAsync("""
    CREATE TABLE Users (Id TEXT PRIMARY KEY, Name TEXT, Email TEXT, PasswordHash TEXT, Role TEXT,
      PhoneNumber TEXT, NicNumber TEXT, IsNicVerified INTEGER, NicImageUrl TEXT, IsBlocked INTEGER,
      CreatedAt TEXT, UpdatedAt TEXT);
    """);
var user = new User { Name = "Test", Email = "test@example.com", PasswordHash = BCrypt.Net.BCrypt.HashPassword("OldPassword123!") };
db.Users.Add(user);
await db.SaveChangesAsync();
using var store = new PasswordResetStore();
var sender = new FakeSender();
var clock = new FakeClock();
var service = new PasswordResetService(db, store, sender, clock);
var checks = 0;
void Check(bool condition, string name)
{
    if (!condition) throw new Exception(name);
    Console.WriteLine($"PASS: {name}"); checks++;
}
async Task Reject(Func<Task> action, string name)
{
    try { await action(); } catch (PasswordResetException) { Check(true, name); return; }
    throw new Exception($"Expected rejection: {name}");
}
VerifyPasswordOtpDto Code(string code) => new() { Email = user.Email, Code = code };
ResetPasswordDto Reset(string token) => new() { Email = user.Email, ResetToken = token, NewPassword = "NewPassword123!", ConfirmPassword = "NewPassword123!" };

var expires = await service.SendAsync(" TEST@example.com ");
Check(expires == clock.GetUtcNow().AddSeconds(60), "OTP expires after exactly 60 seconds");
Check(sender.Email == user.Email && sender.Code.Length == 6 && sender.Code.All(char.IsDigit), "Six-digit code is sent to normalized registered email");
await Reject(() => service.SendAsync(user.Email), "Early resend is throttled");
var code = sender.Code;
clock.Advance(60);
await Reject(() => service.VerifyAsync(Code(code)), "OTP is rejected at exact expiry boundary");
await service.SendAsync(user.Email);
code = sender.Code;
var wrong = code == "000000" ? "111111" : "000000";
for (var i = 0; i < 5; i++) await Reject(() => service.VerifyAsync(Code(wrong)), $"Wrong OTP attempt {i + 1} rejected");
await Reject(() => service.VerifyAsync(Code(code)), "Correct OTP cannot bypass exhausted attempt limit");
clock.Advance(60);
await service.SendAsync(user.Email);
var token = await service.VerifyAsync(Code(sender.Code));
await Reject(() => service.VerifyAsync(Code(sender.Code)), "Verified OTP cannot be reused");
await Reject(() => service.ResetAsync(Reset("invalid-token")), "Unverified reset token is rejected");
await service.ResetAsync(Reset(token));
Check(BCrypt.Net.BCrypt.Verify("NewPassword123!", user.PasswordHash) && !BCrypt.Net.BCrypt.Verify("OldPassword123!", user.PasswordHash), "New password works and old password stops working");
await Reject(() => service.ResetAsync(Reset(token)), "Reset token is single use");

await service.SendAsync(user.Email);
token = await service.VerifyAsync(Code(sender.Code));
clock.Advance(60);
await service.SendAsync(user.Email);
await Reject(() => service.ResetAsync(Reset(token)), "Resend invalidates previously verified reset token");
token = await service.VerifyAsync(Code(sender.Code));
clock.Advance(600);
await Reject(() => service.ResetAsync(Reset(token)), "Reset token expires after ten minutes");

var sent = sender.Count;
await service.SendAsync("unknown@example.com");
Check(sender.Count == sent, "Unknown account does not receive email");
await Reject(() => service.VerifyAsync(new() { Email = "unknown@example.com", Code = "000000" }), "Unknown account cannot verify");
user.IsBlocked = true;
await db.SaveChangesAsync();
await service.SendAsync(user.Email);
Check(sender.Count == sent, "Blocked accounts cannot recover password");
user.IsBlocked = false;
await db.SaveChangesAsync();
clock.Advance(60);
sender.Fail = true;
try { await service.SendAsync(user.Email); throw new Exception("Expected email failure"); }
catch (IOException) { Check(store.Get(user.Email) == null, "Failed email leaves no usable OTP or resend cooldown"); }
sender.Fail = false;
await service.SendAsync(user.Email);
token = await service.VerifyAsync(Code(sender.Code));
var results = await Task.WhenAll(Enumerable.Range(0, 2).Select(async _ =>
{
    try { await service.ResetAsync(Reset(token)); return true; } catch (PasswordResetException) { return false; }
}));
Check(results.Count(x => x) == 1, "Concurrent reset requests consume the token once");
var mismatched = Reset("token"); mismatched.ConfirmPassword = "Different123!";
Check(!Validator.TryValidateObject(mismatched, new ValidationContext(mismatched), new List<ValidationResult>(), true), "API validation rejects mismatched confirmation");
var shortPassword = Reset("token"); shortPassword.NewPassword = shortPassword.ConfirmPassword = "short";
Check(!Validator.TryValidateObject(shortPassword, new ValidationContext(shortPassword), new List<ValidationResult>(), true), "API validation rejects short passwords");
Console.WriteLine($"All {checks} password reset checks passed.");

sealed class FakeClock : TimeProvider
{
    private DateTimeOffset _now = DateTimeOffset.UtcNow;
    public override DateTimeOffset GetUtcNow() => _now;
    public void Advance(int seconds) => _now = _now.AddSeconds(seconds);
}
sealed class FakeSender : IPasswordResetEmailSender
{
    public string Email { get; private set; } = "";
    public string Code { get; private set; } = "";
    public int Count { get; private set; }
    public bool Fail { get; set; }
    public Task SendAsync(string email, string code)
    {
        if (Fail) throw new IOException("Simulated SMTP outage");
        Email = email; Code = code; Count++;
        return Task.CompletedTask;
    }
}
