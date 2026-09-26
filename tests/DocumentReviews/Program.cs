using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using RentWise.API.Data;
using RentWise.API.Modules.PropertyManagement.Controllers;
using RentWise.API.Modules.PropertyManagement.Entities;

await using var connection = new SqliteConnection("Data Source=:memory:");
await connection.OpenAsync();
await using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(connection).Options);
// Only create the tables used by these controller flows; no application startup,
// migrations, real storage, or deployed database is involved.
await db.Database.ExecuteSqlRawAsync("""
    CREATE TABLE Properties (Id TEXT PRIMARY KEY, OwnerId TEXT, Title TEXT, Description TEXT, Address TEXT,
      MonthlyRent TEXT, Bedrooms INTEGER, Bathrooms INTEGER, Facilities TEXT, Sqft INTEGER, PropertyType TEXT,
      FeatureTags TEXT, PhotoCount INTEGER, Status INTEGER, CreatedAt TEXT, UpdatedAt TEXT);
    CREATE TABLE PropertyDocuments (Id TEXT PRIMARY KEY, PropertyId TEXT, DocumentType TEXT, DocumentUrl TEXT, CreatedAt TEXT, UpdatedAt TEXT);
    CREATE TABLE VerificationRecords (Id TEXT PRIMARY KEY, PropertyId TEXT, AdminId TEXT, IsApproved INTEGER, Comments TEXT, AgentReport TEXT, CreatedAt TEXT, UpdatedAt TEXT);
    CREATE TABLE DocumentReviewRequests (Id TEXT PRIMARY KEY, PropertyId TEXT, OwnerId TEXT, AdminId TEXT, Message TEXT,
      DocumentUrl TEXT, ReplacementDocumentUrl TEXT, ResubmittedAt TEXT, CreatedAt TEXT, UpdatedAt TEXT);
    """);
var ownerId = Guid.NewGuid();
var otherOwnerId = Guid.NewGuid();
var property = new Property { OwnerId = ownerId, Title = "Test property", Address = "123 Test Road", Status = PropertyStatus.Active };
db.Properties.Add(property);
var oldDocument = new PropertyDocument { PropertyId = property.Id, DocumentType = "UtilityBill", DocumentUrl = "https://example.test/old.jpg" };
db.PropertyDocuments.Add(oldDocument);
await db.SaveChangesAsync();

void Login(ControllerBase controller, Guid id, string role) => controller.ControllerContext = new ControllerContext
{
    HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(new[]
    { new Claim(ClaimTypes.NameIdentifier, id.ToString()), new Claim(ClaimTypes.Role, role) }, "Test")) }
};
var checks = 0;
void Check(bool condition, string name)
{
    if (!condition) throw new Exception(name);
    checks++;
    Console.WriteLine($"PASS: {name}");
}
var reviews = new DocumentReviewsController(db);
var note = new DocumentReviewDto { PropertyId = property.Id, Message = "Please upload a clearer bill.", DocumentUrl = oldDocument.DocumentUrl };
Login(reviews, ownerId, "Owner");
Check(await reviews.RequestReplacement(note) is ForbidResult, "Owners cannot send administrator requests");
Login(reviews, Guid.NewGuid(), "Admin");
Check(await reviews.RequestReplacement(new DocumentReviewDto { PropertyId = property.Id, Message = " " }) is BadRequestObjectResult, "Blank messages are rejected");
Check(await reviews.RequestReplacement(new DocumentReviewDto { PropertyId = property.Id, Message = "Fix proof", DocumentUrl = "https://example.test/unrelated.jpg" }) is BadRequestObjectResult, "Unrelated documents are rejected");
Check(await reviews.RequestReplacement(note) is OkObjectResult, "Administrator sends a persistent note");
Check(property.Status == PropertyStatus.PendingVerification, "Requested correction unpublishes listing for review");
Check(await reviews.RequestReplacement(note) is ConflictObjectResult, "Duplicate outstanding request is rejected");
var request = await db.DocumentReviewRequests.SingleAsync();

Login(reviews, otherOwnerId, "Owner");
var hidden = (OkObjectResult)await reviews.GetMessages(property.Id);
Check(JsonSerializer.SerializeToElement(hidden.Value).GetArrayLength() == 0, "Other owners cannot read private notes");
Login(reviews, ownerId, "Owner");
var inbox = (OkObjectResult)await reviews.GetMessages();
Check(JsonSerializer.SerializeToElement(inbox.Value).GetArrayLength() == 1, "Owner sees administrator note");

var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
{ ["AgenticServiceUrl"] = "http://127.0.0.1:1" }).Build();
var properties = new PropertiesController(null!, db, config);
var replacement = new OwnershipProofDto { DocumentUrl = "https://example.test/new.jpg", ReviewRequestId = request.Id };
Login(properties, otherOwnerId, "Owner");
Check(await properties.UploadOwnershipProof(property.Id, replacement) is ForbidResult, "Other owners cannot answer document requests");
Login(properties, ownerId, "Owner");
Check(await properties.UploadOwnershipProof(property.Id, new OwnershipProofDto { DocumentUrl = oldDocument.DocumentUrl, ReviewRequestId = request.Id }) is BadRequestObjectResult, "Flagged document cannot be resubmitted unchanged");
Check(await properties.UploadOwnershipProof(property.Id, replacement) is OkObjectResult, "Replacement saves even if AI service is unavailable");
Check(request.ResubmittedAt != null && request.ReplacementDocumentUrl == replacement.DocumentUrl, "Request links to the replacement and submission time");
Check(property.Status == PropertyStatus.PendingVerification, "Replacement awaits administrator review");
Check(await properties.UploadOwnershipProof(property.Id, replacement) is ConflictObjectResult, "Answered requests cannot be submitted twice");
Check(await db.PropertyDocuments.CountAsync() == 2, "Original and replacement proofs are retained");
Console.WriteLine($"Passed {checks} document review regression checks.");
