using System.Net;
using System.Net.Mail;

namespace RentWise.API.Modules.Users.Services;

public interface IPasswordResetEmailSender
{
    Task SendAsync(string email, string code);
}

public sealed class PasswordResetEmailSender(IConfiguration configuration) : IPasswordResetEmailSender
{
    public async Task SendAsync(string email, string code)
    {
        string? Setting(string key) => Environment.GetEnvironmentVariable($"SMTP_{key.ToUpperInvariant()}") ?? configuration[$"Smtp:{key}"];
        var host = Setting("Host") ?? throw new InvalidOperationException("SMTP host is not configured.");
        var from = Setting("From") ?? throw new InvalidOperationException("SMTP sender is not configured.");
        using var client = new SmtpClient(host, int.TryParse(Setting("Port"), out var port) ? port : 587)
        {
            EnableSsl = true,
            Credentials = new NetworkCredential(Setting("Username"), Setting("Password"))
        };
        using var message = new MailMessage { From = new MailAddress(from, "RentWise"), Subject = "Your RentWise password reset code" };
        message.To.Add(email);
        message.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(
            $"Your RentWise password reset code is {code}. It expires in 1 minute. Never share this code. If you did not request this, ignore this email.", null, "text/plain"));
        message.AlternateViews.Add(AlternateView.CreateAlternateViewFromString($"""
            <!doctype html><html><body style="margin:0;background:#eef2ff;font-family:Arial,sans-serif;color:#172033">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:40px 16px">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:24px;overflow:hidden">
            <tr><td style="padding:30px 32px;background:#2563eb;color:white;font-size:25px;font-weight:bold">RentWise<span style="font-size:12px;display:block;margin-top:8px;letter-spacing:2px">ACCOUNT SECURITY</span></td></tr>
            <tr><td style="padding:32px"><h1 style="font-size:26px;margin:0 0 16px">A fresh start, securely.</h1>
            <p style="color:#64748b;line-height:1.7">Use this verification code to reset your RentWise password.</p>
            <div style="padding:24px 12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:16px;text-align:center;font-size:36px;font-weight:bold;letter-spacing:8px;color:#2563eb">{code}</div>
            <p style="text-align:center;font-size:14px;color:#475569">This code expires in <strong>1 minute</strong>.</p>
            <p style="margin-top:28px;font-size:13px;line-height:1.7;color:#64748b">Never share this code with anyone. RentWise will never ask you to share your code.<br><br>If you didn't request a password reset, you can safely ignore this email. Your password has not changed.</p></td></tr>
            <tr><td style="padding:20px 32px;background:#f8fafc;color:#94a3b8;font-size:12px;text-align:center">RentWise &middot; Your next home starts here.</td></tr>
            </table></td></tr></table></body></html>
            """, null, "text/html"));
        await client.SendMailAsync(message);
    }
}
