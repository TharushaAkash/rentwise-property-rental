using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RentWise.API.Common.Repositories;
using RentWise.API.Data;
using RentWise.API.Modules.Agreements.Controllers;
using RentWise.API.Modules.Agreements.Entities;
using RentWise.API.Modules.Agreements.Services;
using RentWise.API.Modules.PropertyManagement.Entities;
using RentWise.API.Modules.Users;

await using var connection = new SqliteConnection("Data Source=:memory:");
await connection.OpenAsync();
await using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(connection).Options);
await db.Database.EnsureCreatedAsync();
var owner = new User { Name = "Owner", Email = "owner@example.com", PasswordHash = "test-only", Role = "Owner" };
var tenant = new User { Name = "Tenant <script>", Email = "tenant@example.com", PasswordHash = "test-only" };
var property = new Property { Owner = owner, Title = "Garden <House>", Address = "12 Lake Road" };
var agreement = new RentalAgreement
{
    Owner = owner, Tenant = tenant, Property = property,
    StartDate = new DateTime(2026, 10, 1), EndDate = new DateTime(2027, 4, 1),
    AgreedMonthlyRent = 50000, SecurityDeposit = 100000
};
db.RentalAgreements.Add(agreement);
await db.SaveChangesAsync();
var sender = new FakeSender(db);
var controller = new RentalAgreementsController(new RentalAgreementService(new Repository<RentalAgreement>(db)), db, sender, NullLogger<RentalAgreementsController>.Instance);
var checks = 0;
void Check(bool condition, string name)
{
    if (!condition) throw new Exception(name);
    checks++;
    Console.WriteLine($"PASS: {name}");
}

Check(await controller.PayForLease(Guid.NewGuid(), new()) is NotFoundObjectResult && sender.Count == 0, "Missing booking sends no email");
var response = (OkObjectResult)await controller.PayForLease(agreement.Id, new AgreementPaymentDto { Amount = 100000, PaymentMethod = "Bank transfer", PaymentReference = "REF-123" });
Check(JsonSerializer.SerializeToElement(response.Value).GetProperty("confirmationEmailSent").GetBoolean(), "Successful payment reports email sent");
Check(sender.Count == 1 && sender.SavedBeforeEmail, "Email is sent only after payment has been saved");
Check(sender.Agreement!.Tenant.Email == "tenant@example.com", "Recipient comes from booking tenant");
Check(agreement.Status == AgreementStatus.Active, "Booking is active when confirmation is sent");
using var message = BookingConfirmationEmailSender.CreateMessage(sender.Agreement!, sender.Payment!, sender.Method, "no-reply@example.com");
Check(message.To.Single().Address == tenant.Email, "SMTP message is addressed to the tenant");
var html = await new StreamReader(message.AlternateViews[1].ContentStream).ReadToEndAsync();
var plain = await new StreamReader(message.AlternateViews[0].ContentStream).ReadToEndAsync();
Check(html.Contains("Garden &lt;House&gt;") && html.Contains("Tenant &lt;script&gt;") && !html.Contains("<script>"), "Email safely encodes tenant and property text");
Check(html.Contains("100,000.00") && html.Contains("50,000.00") && html.Contains("REF-123") && html.Contains("Bank transfer"), "Email includes amount, rent, deposit, reference and payment method");
Check(html.Contains("01 Oct 2026") && html.Contains("01 Apr 2027") && html.Contains("12 Lake Road") && html.Contains(agreement.Id.ToString()), "Email includes booking reference, property address and lease dates");
Check(plain.Contains("REF-123") && plain.Contains("100,000.00"), "Plain-text email includes receipt details");
sender.Fail = true;
response = (OkObjectResult)await controller.PayForLease(agreement.Id, new AgreementPaymentDto { Amount = 50000, PaymentReference = "REF-456" });
var data = JsonSerializer.SerializeToElement(response.Value);
Check(data.GetProperty("success").GetBoolean() && !data.GetProperty("confirmationEmailSent").GetBoolean(), "Email outage does not report payment failure");
Check(await db.Payments.CountAsync() == 2, "Payment remains saved when email fails");
var failedPayment = new Payment { RentalAgreementId = agreement.Id, IsSuccessful = false };
try
{
    using var rejected = BookingConfirmationEmailSender.CreateMessage(agreement, failedPayment, "Card", "no-reply@example.com");
    throw new Exception("Failed payment produced confirmation");
}
catch (InvalidOperationException) { Check(true, "Failed payment cannot produce a successful receipt"); }
Console.WriteLine($"All {checks} booking email checks passed.");

sealed class FakeSender(ApplicationDbContext db) : IBookingConfirmationEmailSender
{
    public int Count { get; private set; }
    public bool SavedBeforeEmail { get; private set; }
    public bool Fail { get; set; }
    public RentalAgreement? Agreement { get; private set; }
    public Payment? Payment { get; private set; }
    public string Method { get; private set; } = "";
    public async Task SendAsync(RentalAgreement agreement, Payment payment, string paymentMethod)
    {
        Count++;
        SavedBeforeEmail = await db.Payments.AsNoTracking().AnyAsync(p => p.Id == payment.Id && p.IsSuccessful);
        Agreement = agreement; Payment = payment; Method = paymentMethod;
        if (Fail) throw new IOException("Simulated SMTP failure");
    }
}
