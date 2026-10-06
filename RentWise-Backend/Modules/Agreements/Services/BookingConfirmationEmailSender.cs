using System.Globalization;
using System.Net;
using System.Net.Mail;
using RentWise.API.Modules.Agreements.Entities;

namespace RentWise.API.Modules.Agreements.Services;

public interface IBookingConfirmationEmailSender
{
    Task SendAsync(RentalAgreement agreement, Payment payment, string paymentMethod);
}

public class BookingConfirmationEmailSender(IConfiguration configuration) : IBookingConfirmationEmailSender
{
    public async Task SendAsync(RentalAgreement agreement, Payment payment, string paymentMethod)
    {
        string? Setting(string key) => Environment.GetEnvironmentVariable($"SMTP_{key.ToUpperInvariant()}") ?? configuration[$"Smtp:{key}"];
        var host = Setting("Host") ?? throw new InvalidOperationException("SMTP host is not configured.");
        var from = Setting("From") ?? throw new InvalidOperationException("SMTP sender is not configured.");
        using var client = new SmtpClient(host, int.TryParse(Setting("Port"), out var port) ? port : 587)
        {
            EnableSsl = true,
            Credentials = new NetworkCredential(Setting("Username"), Setting("Password"))
        };
        using var message = CreateMessage(agreement, payment, paymentMethod, from);
        // A slow mail provider must not hold up the payment response indefinitely.
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(8));
        await client.SendMailAsync(message, timeout.Token);
    }

    public static MailMessage CreateMessage(RentalAgreement agreement, Payment payment, string paymentMethod, string from)
    {
        if (!payment.IsSuccessful || payment.RentalAgreementId != agreement.Id)
            throw new InvalidOperationException("A successful payment for this booking is required.");

        string Money(decimal value) => $"LKR {value.ToString("N2", CultureInfo.InvariantCulture)}";
        string Date(DateTime value) => value.ToString("dd MMM yyyy", CultureInfo.InvariantCulture);
        string Html(string? value) => WebUtility.HtmlEncode(value ?? "");
        var details = new (string Label, string Value)[]
        {
            ("Booking reference", agreement.Id.ToString()),
            ("Property", agreement.Property.Title),
            ("Address", agreement.Property.Address),
            ("Property owner", agreement.Owner.Name),
            ("Lease period", $"{Date(agreement.StartDate)} – {Date(agreement.EndDate)}"),
            ("Booking status", agreement.Status.ToString()),
            ("Monthly rent", Money(agreement.AgreedMonthlyRent)),
            ("Security deposit", Money(agreement.SecurityDeposit)),
            ("Amount paid", Money(payment.Amount)),
            ("Payment reference", payment.PaymentReference),
            ("Payment date (UTC)", payment.PaymentDate.ToString("dd MMM yyyy, HH:mm", CultureInfo.InvariantCulture)),
            ("Payment method", string.IsNullOrWhiteSpace(paymentMethod) ? "Not specified" : paymentMethod),
            ("Payment status", "Successful")
        };
        var rows = string.Join("", details.Select(detail =>
            $"<tr><td style=\"padding:12px 0;border-bottom:1px solid #e2e8f0;color:#64748b;vertical-align:top;width:38%\">{Html(detail.Label)}</td><td style=\"padding:12px 0 12px 16px;border-bottom:1px solid #e2e8f0;color:#172033;overflow-wrap:anywhere\">{Html(detail.Value)}</td></tr>"));
        var plainText = $"Hi {agreement.Tenant.Name},\n\nYour booking is confirmed and your payment has been recorded successfully.\n\n" +
            string.Join("\n", details.Select(detail => $"{detail.Label}: {detail.Value}")) +
            "\n\nKeep this email for your records. View your agreement and payment history in RentWise.\nRentWise";
        var html = $"""
            <!doctype html><html><body style="margin:0;background:#f0f7f3;font-family:Arial,sans-serif">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:36px 16px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:white;border-radius:24px;overflow:hidden">
            <tr><td style="background:#008037;padding:28px 32px;color:white;font-size:26px;font-weight:bold">RentWise<span style="display:block;font-size:11px;letter-spacing:2px;margin-top:8px">BOOKING &amp; PAYMENT CONFIRMATION</span></td></tr>
            <tr><td style="padding:32px"><h1 style="font-size:25px;color:#172033;margin:0 0 18px">Your next chapter is confirmed.</h1>
            <p style="color:#475569;line-height:1.7">Hi {Html(agreement.Tenant.Name)},<br>Your booking is confirmed and your payment has been recorded successfully.</p>
            <div style="padding:20px;background:#e6f5ec;border-radius:16px;color:#005c27"><span style="font-size:13px">PAYMENT SUCCESSFUL</span><strong style="display:block;font-size:30px;margin-top:8px">{Money(payment.Amount)}</strong></div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;font-size:14px;line-height:1.5">{rows}</table>
            <p style="font-size:13px;color:#64748b;line-height:1.7;margin-top:24px">Keep this email for your records. You can view your agreement and payment history in the RentWise app or website.</p></td></tr>
            <tr><td style="padding:20px;background:#f8fafc;text-align:center;color:#64748b;font-size:12px">RentWise &middot; Your next home starts here.</td></tr>
            </table></td></tr></table></body></html>
            """;
        var message = new MailMessage
        {
            From = new MailAddress(from, "RentWise"),
            Subject = "Your RentWise booking and payment confirmation"
        };
        // Always use the tenant on the saved agreement, never a request-supplied email.
        message.To.Add(agreement.Tenant.Email);
        message.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(plainText, null, "text/plain"));
        message.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(html, null, "text/html"));
        return message;
    }
}
