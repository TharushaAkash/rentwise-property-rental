using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using RentWise.API.Data;
using RentWise.API.Modules.Users;
using RentWise.API.Modules.PropertyManagement.Entities;
using RentWise.API.Modules.PropertyManagement.Controllers;

var pg = Environment.GetEnvironmentVariable("RENTWISE_BOOKING_TEST_DB");
await using var sqlite = new SqliteConnection("Data Source=:memory:");
await sqlite.OpenAsync();
var options = string.IsNullOrEmpty(pg) ? new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(sqlite).Options
    : new DbContextOptionsBuilder<ApplicationDbContext>().UseNpgsql(pg).Options;
if (pg != null && !new Npgsql.NpgsqlConnectionStringBuilder(pg).Database!.StartsWith("rentwise_booking_test_"))
    throw new Exception("Use an isolated rentwise_booking_test_* database only");
ApplicationDbContext NewDb() => new(options);
await using var setup = NewDb();
if (pg == null) await setup.Database.EnsureCreatedAsync(); else await setup.Database.MigrateAsync();
if (await setup.Users.AnyAsync()) throw new Exception("Test database must be empty");
var owner = new User { Name="Owner", Email="owner@fixture.invalid", Role="PropertyOwner" };
var tenant = new User { Name="Tenant", Email="tenant@fixture.invalid", Role="Tenant" };
var stranger = new User { Name="Other", Email="other@fixture.invalid", Role="Tenant" };
var listing = new Property { OwnerId=owner.Id, Title="Fixture", Address="Malabe", MonthlyRent=50000, Status=PropertyStatus.Active };
setup.AddRange(owner, tenant, stranger, listing); await setup.SaveChangesAsync();
var checks=0;
void Check(bool result, string message) { if (!result) throw new Exception(message); checks++; }
PropertyApplicationsController Controller(ApplicationDbContext db, Guid id, string role) => new(db) {
 ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext {
 User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier,id.ToString()), new Claim(ClaimTypes.Role,role) }, "fixture")) } } };
StartPropertyApplication Request() => new() { PropertyId=listing.Id, StartDate=DateTime.UtcNow.Date.AddDays(5), DurationMonths=6, Message="Fixture request" };
Guid applicationId;
// Reproduce the provider wrapper deterministically, regardless of race timing.
var wrappedConflict = new InvalidOperationException("Transient failure",
 new DbUpdateException("Save failed", new Npgsql.PostgresException("Serialization failure", "ERROR", "ERROR", "40001")));
var unrelatedFailure = new InvalidOperationException("Unrelated failure");
foreach (var failure in new[] { wrappedConflict, unrelatedFailure }) {
 var failureOptions = new DbContextOptionsBuilder<ApplicationDbContext>(options)
  .AddInterceptors(new FailingSaveInterceptor(failure)).Options;
 await using var db = new ApplicationDbContext(failureOptions);
 try {
  var result = await Controller(db, tenant.Id, "Tenant").CreateApplication(Request());
  Check(ReferenceEquals(failure, wrappedConflict) && result is ConflictObjectResult,
   "Wrapped PostgreSQL serialization failure returns conflict");
 } catch (InvalidOperationException ex) when (ReferenceEquals(ex, unrelatedFailure)) {
  Check(true, "Unrelated exceptions are not hidden as booking conflicts");
 }
}
Check(!await setup.PropertyApplications.AnyAsync(), "Failed saves do not persist bookings");
await using (var db=NewDb()) {
 var result=await Controller(db,tenant.Id,"Tenant").CreateApplication(Request());
 Check(result is OkObjectResult,"Tenant can create booking");
 var data=JsonSerializer.SerializeToElement(((OkObjectResult)result).Value);
 applicationId=data.GetProperty("Id").GetGuid();
 Check(data.GetProperty("TenantId").GetGuid()==tenant.Id,"Tenant identity comes from JWT");
 Check(data.GetProperty("MonthlyRent").GetDecimal()==50000,"Price comes from listing");
}
await using (var db=NewDb()) {
 Check(await db.PropertyApplications.AnyAsync(a=>a.Id==applicationId),"Booking survives a new DbContext");
 var list=(OkObjectResult)await Controller(db,stranger.Id,"Tenant").GetApplications();
 Check(JsonSerializer.SerializeToElement(list.Value).GetArrayLength()==0,"Other tenant cannot read booking");
 Check(await Controller(db,stranger.Id,"PropertyOwner").ConfirmApplication(applicationId) is NotFoundResult,"Unrelated owner cannot approve");
 Check(await Controller(db,tenant.Id,"Tenant").ConfirmApplication(applicationId) is ForbidResult,"Tenant cannot self approve");
 Check(await Controller(db,owner.Id,"PropertyOwner").ConfirmApplication(Guid.NewGuid()) is NotFoundResult,"Unknown ID does not create a booking");
}
await using (var db=NewDb()) Check(await Controller(db,stranger.Id,"Tenant").CreateApplication(Request()) is ConflictObjectResult,"Duplicate active booking rejected");
await using (var db=NewDb()) Check(await Controller(db,owner.Id,"PropertyOwner").RejectApplication(applicationId) is OkObjectResult,"Owner can reject");
await using (var db=NewDb()) Check(await Controller(db,owner.Id,"PropertyOwner").ConfirmApplication(applicationId) is ConflictObjectResult,"Stale approval cannot overwrite rejection");
if (pg != null) {
 async Task<IActionResult> Race(Guid who) { await using var db=NewDb(); return await Controller(db,who,"Tenant").CreateApplication(Request()); }
 var results=await Task.WhenAll(Task.Run(()=>Race(tenant.Id)), Task.Run(()=>Race(stranger.Id)));
 Check(results.Count(r=>r is OkObjectResult)==1,"Concurrent requests create exactly one booking");
 Check(results.Count(r=>r is ConflictObjectResult)==1,"Concurrent loser receives conflict");
} else {
 await using var db=NewDb();
 Check(await Controller(db,tenant.Id,"Tenant").CreateApplication(Request()) is OkObjectResult,"Rejection releases listing");
}
await using (var db=NewDb()) {
 var active=await db.PropertyApplications.AsNoTracking().SingleAsync(a=>a.Status=="Submitted");
 Check(await Controller(db,owner.Id,"PropertyOwner").ConfirmApplication(active.Id) is OkObjectResult,"Owner approval persists");
 Check(await Controller(db,owner.Id,"PropertyOwner").ConfirmApplication(active.Id) is OkObjectResult,"Repeated approval is idempotent");
 Check(await Controller(db,owner.Id,"PropertyOwner").RejectApplication(active.Id) is ConflictObjectResult,"Reject cannot overwrite accepted booking");
 var invalid=Request(); invalid.DurationMonths=0;
 Check(await Controller(db,tenant.Id,"Tenant").CreateApplication(invalid) is BadRequestObjectResult,"Invalid duration rejected");
}
// Browsing must paginate in the database and apply filters before the limit.
await using (var db = NewDb()) {
 for (var i = 0; i < 25; i++) db.Properties.Add(new Property {
  OwnerId = owner.Id, Title = $"Browse fixture {i}", Address = "BrowseTest Colombo",
  MonthlyRent = 50000 + i * 1000, Bedrooms = 2, PropertyType = "Apartment",
  Status = i == 24 ? PropertyStatus.PendingVerification : PropertyStatus.Active
 });
 await db.SaveChangesAsync();
 var controller = new PropertiesController(null!, db, null!);
 async Task<JsonElement> Page(string? cursor = null, decimal? budget = null) {
  var result = (OkObjectResult)await controller.Browse("BrowseTest", null, budget, 2,
   propertyType: "Apartment", cursor: cursor);
  return JsonSerializer.SerializeToElement(result.Value);
 }
 var first = await Page();
 Check(first.GetProperty("items").GetArrayLength() == 12, "Browse returns only twelve listings");
 Check(first.GetProperty("hasMore").GetBoolean(), "Browse exposes next page");
 var second = await Page(first.GetProperty("nextCursor").GetString());
 Check(second.GetProperty("items").GetArrayLength() == 12, "Cursor returns remaining active listings");
 Check(!second.GetProperty("hasMore").GetBoolean(), "Final page has no next cursor");
 var ids = first.GetProperty("items").EnumerateArray().Select(p => p.GetProperty("Id").GetGuid())
  .Concat(second.GetProperty("items").EnumerateArray().Select(p => p.GetProperty("Id").GetGuid()));
 Check(ids.Distinct().Count() == 24, "Pages do not repeat listings or include pending listings");
 Check(await controller.Browse(null, null, null, null, cursor: "invalid") is BadRequestObjectResult,
  "Invalid cursor is rejected");
 if (pg != null) {
  var filtered = await Page(budget: 53000);
  Check(filtered.GetProperty("items").GetArrayLength() == 4, "Budget filter applies before pagination");
 }
}
Console.WriteLine($"{checks} booking checks passed ({(pg == null ? "SQLite" : "PostgreSQL migrations + concurrent requests")}).");

sealed class FailingSaveInterceptor(Exception failure) : SaveChangesInterceptor
{
 public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
  DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
  => throw failure;
}
