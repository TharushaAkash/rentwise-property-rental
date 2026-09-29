using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using RentWise.API.Data;
using RentWise.API.Modules.AgenticAI;
using RentWise.API.Modules.AgenticAI.Controllers;
using RentWise.API.Modules.AgenticAI.Entities;
using RentWise.API.Modules.AgenticAI.Services;
using RentWise.API.Modules.Agreements.Entities;
using RentWise.API.Modules.PropertyManagement.Entities;
using RentWise.API.Modules.Users;

await using var connection = new SqliteConnection("Data Source=:memory:");
await connection.OpenAsync();
var pgConnection = Environment.GetEnvironmentVariable("RENTWISE_WORKFLOW_TEST_DB");
var options = string.IsNullOrEmpty(pgConnection)
    ? new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(connection).Options
    : new DbContextOptionsBuilder<ApplicationDbContext>().UseNpgsql(pgConnection).Options;
ApplicationDbContext NewDb() => string.IsNullOrEmpty(pgConnection) ? new TestDb(options) : new ApplicationDbContext(options);
await using var db = NewDb();
if (string.IsNullOrEmpty(pgConnection)) await db.Database.EnsureCreatedAsync();
else
{
    if (!new Npgsql.NpgsqlConnectionStringBuilder(pgConnection).Database!.StartsWith("rentwise_workflow_test_"))
        throw new Exception("Use a new, disposable database named rentwise_workflow_test_*; never use the application database.");
    await db.Database.MigrateAsync();
    if (await db.Users.AnyAsync()) throw new Exception("Test database must be empty.");
}
var owner = new User { Name = "Owner", Email = "owner@test.invalid", Role = "PropertyOwner" };
var tenant = new User { Name = "Tenant", Email = "tenant@test.invalid", Role = "Tenant" };
var stranger = new User { Name = "Other", Email = "other@test.invalid", Role = "PropertyOwner" };
db.Users.AddRange(owner, tenant, stranger);
var property = new Property { VerificationRecords = new List<VerificationRecord> { new() { Comments = "[LISTING_FEE_PAID: fixture]" } }, OwnerId = owner.Id, Title = "Malabe house", Address = "1 Test Road, Malabe", Status = PropertyStatus.Active, MonthlyRent = 50000 };
db.Properties.Add(property);
await db.SaveChangesAsync();
var agent = new FakeAgent(property.Id);
var service = new RentalWorkflowService(db, agent);
var controller = new RentalWorkflowsController(db, service);
var checks = 0;
void Check(bool condition, string name) { if (!condition) throw new Exception(name); checks++; Console.WriteLine("PASS: " + name); }
void Login(Guid id, string role) => controller.ControllerContext = new ControllerContext
{
    HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity([
        new Claim(ClaimTypes.NameIdentifier, id.ToString()), new Claim(ClaimTypes.Role, role)], "Test")) }
};
StartRentalWorkflow Request() => new() { Objective = "A home in Malabe with parking", MaxMonthlyRent = 60000, StartDate = DateTime.UtcNow.Date.AddDays(7), EndDate = DateTime.UtcNow.Date.AddMonths(6) };
async Task<AgentWorkflowRun> Prepared()
{
    var r = await service.Start(tenant.Id, Request());
    for (var i = 0; i < 4; i++)
    {
        // Recreate the context between steps, proving output is loaded from durable state.
        await using var resumed = NewDb();
        var persisted = await resumed.AgentWorkflowRuns.SingleAsync(x => x.Id == r.Id);
        await new RentalWorkflowService(resumed, agent).Advance(persisted);
        Check(persisted.Status != "Failed", $"Step {i + 1} resumes persisted state");
    }
    await db.Entry(r).ReloadAsync();
    return r;
}

Login(owner.Id, "PropertyOwner");
Check(await controller.Start(Request()) is ForbidResult, "Owners cannot impersonate a tenant to start a workflow");
Login(tenant.Id, "Tenant");
var bad = Request(); bad.MaxMonthlyRent = 0;
Check(await controller.Start(bad) is BadRequestObjectResult, "Invalid objective parameters fail before persistence");
var run = await Prepared();
Check(run.Status == "AwaitingApproval", "Four agents pause for approval");
Check(!await db.RentalAgreements.AnyAsync(), "Agent chain cannot create an agreement before approval");
Check(agent.SawChainedInput, "Each agent receives previous outputs");
var decision = new WorkflowDecision { Decision = "approve", Version = run.Version };
Check(await controller.Decide(run.Id, decision) is ForbidResult, "Tenant cannot approve own workflow");
Login(stranger.Id, "PropertyOwner");
Check(await controller.Get(run.Id) is NotFoundResult, "Unrelated owner cannot read workflow");
Check(await controller.Decide(run.Id, decision) is NotFoundResult, "Unrelated owner cannot approve workflow");
Login(owner.Id, "PropertyOwner");
Check(await controller.Decide(run.Id, new WorkflowDecision { Decision = "approve", Version = -1 }) is ConflictObjectResult, "Stale approval rejected");
Check(await controller.Decide(run.Id, decision) is OkObjectResult, "Owner approves saved proposal");
var agreement = await db.RentalAgreements.SingleAsync();
Check(agreement.Status == AgreementStatus.Drafted && agreement.TenantId == tenant.Id && agreement.AgreedMonthlyRent == property.MonthlyRent, "Approved record is a draft with authoritative parties and price");
Check(await controller.Decide(run.Id, decision) is ConflictObjectResult && await db.RentalAgreements.CountAsync() == 1, "Duplicate approval cannot create second agreement");
agreement.Status = AgreementStatus.Ended;
await db.SaveChangesAsync();

var changed = await Prepared();
property.MonthlyRent = 55000;
await db.SaveChangesAsync();
Check(await controller.Decide(changed.Id, new WorkflowDecision { Decision = "approve", Version = changed.Version }) is ConflictObjectResult, "Changed rent invalidates the reviewed draft");
property.MonthlyRent = 50000;
await db.SaveChangesAsync();
property.Status = PropertyStatus.Suspended;
await db.SaveChangesAsync();
Check(await controller.Decide(changed.Id, new WorkflowDecision { Decision = "approve", Version = changed.Version }) is ConflictObjectResult, "Suspended listing cannot be approved from stale state");
property.Status = PropertyStatus.Active;
agreement.Status = AgreementStatus.Active;
await db.SaveChangesAsync();
Check(await controller.Decide(changed.Id, new WorkflowDecision { Decision = "approve", Version = changed.Version }) is ConflictObjectResult, "Overlapping agreement blocks approval");
agreement.Status = AgreementStatus.Ended;
await db.SaveChangesAsync();
Check(await controller.Decide(changed.Id, new WorkflowDecision { Decision = "revise", Note = "Please change lease dates", Version = changed.Version }) is OkObjectResult, "Owner requests revision");
Login(tenant.Id, "Tenant");
Check(await controller.Revise(changed.Id, Request()) is OkObjectResult, "Tenant revises same workflow with history retained");
Check(RentalWorkflowRules.Read(changed.StateJson).Outputs.Count == 0 && await db.AgentWorkflowSteps.AnyAsync(s => s.WorkflowId == changed.Id && s.AgentName == "HumanApproval"), "Revision invalidates outputs but preserves decision audit");

var failed = await service.Start(tenant.Id, Request());
agent.InvalidSelection = true;
await service.Advance(failed);
Check(failed.Status == "Failed" && RentalWorkflowRules.Read(failed.StateJson).Outputs.Count == 0, "Injected unknown property is rejected and recorded safely");
agent.InvalidSelection = false;
await service.Advance(failed);
Check(failed.Status == "Ready", "Failed read-only step can recover without losing history");
var failedTools = await service.Start(tenant.Id, Request());
agent.BadTool = true;
for (var i = 0; i < 3; i++) await service.Advance(failedTools);
Check(failedTools.Status == "Failed", "Unapproved tools fail safely");
var limited = false;
try { await service.Advance(failedTools); } catch (InvalidOperationException) { limited = true; }
Check(limited, "Retries are bounded");
agent.BadTool = false;
var injected = await service.Start(tenant.Id, Request());
agent.ExtraField = true;
await service.Advance(injected);
Check(injected.Status == "Failed", "Fabricated approval fields cannot enter shared state");
agent.ExtraField = false;
var interrupted = await service.Start(tenant.Id, Request());
interrupted.Status = "Executing";
interrupted.UpdatedAt = DateTime.UtcNow.AddMinutes(-4);
await db.SaveChangesAsync();
await service.Advance(interrupted);
Check(interrupted.Status == "Ready", "Expired execution lease recovers after restart");
var exhausted = await service.Start(tenant.Id, Request());
exhausted.Status = "Executing";
exhausted.UpdatedAt = DateTime.UtcNow.AddMinutes(-4);
var exhaustedState = RentalWorkflowRules.Read(exhausted.StateJson);
exhaustedState.Attempts = 3;
exhausted.StateJson = RentalWorkflowRules.Serialize(exhaustedState);
await db.SaveChangesAsync();
await service.Advance(exhausted);
Check(exhausted.Status == "Failed", "Interrupted final attempt becomes a recorded safe failure");

var rejected = await Prepared();
Login(owner.Id, "PropertyOwner");
Check(await controller.Decide(rejected.Id, new WorkflowDecision { Decision = "reject", Note = "Unavailable for this lease", Version = rejected.Version }) is OkObjectResult, "Rejection is durable");
Check(rejected.Status == "Rejected" && rejected.AgreementId == null, "Rejected proposal creates no agreement");
await using (var first = NewDb())
await using (var second = NewDb())
{
    var a = await first.AgentWorkflowRuns.SingleAsync(r => r.Id == interrupted.Id);
    var b = await second.AgentWorkflowRuns.SingleAsync(r => r.Id == interrupted.Id);
    a.Version++; await first.SaveChangesAsync(); b.Version++;
    var conflict = false;
    try { await second.SaveChangesAsync(); } catch (DbUpdateConcurrencyException) { conflict = true; }
    Check(conflict, "Concurrent workers cannot overwrite workflow state");
}
var bank = new RentWise.API.Modules.Users.Controllers.BankDetailsController(db);
Login(owner.Id, "PropertyOwner");
Check(await controller.Delete(run.Id) is ForbidResult, "Owner cannot delete tenant request");
Login(stranger.Id, "Tenant");
Check(await controller.Delete(run.Id) is NotFoundResult, "Another tenant cannot delete request");
Login(tenant.Id, "Tenant");
var runningDeletion = await service.Start(tenant.Id, Request());
runningDeletion.Status = "Executing";
await db.SaveChangesAsync();
Check(await controller.Delete(runningDeletion.Id) is ConflictObjectResult, "Active preparation cannot be deleted mid-step");
Check(await controller.Delete(run.Id) is NoContentResult, "Tenant deletes own completed request");
Check(await controller.Get(run.Id) is NotFoundResult, "Deleted request cannot be opened");
Check(await controller.Advance(run.Id) is NotFoundResult, "Deleted request cannot resume");
Check(await db.RentalAgreements.AnyAsync(a => a.Id == agreement.Id), "Deleting request preserves saved agreement");
Check(await db.AgentWorkflowSteps.AnyAsync(s => s.WorkflowId == run.Id && s.AgentName == "TenantDeletion"), "Deletion retains an audit record");
void BankLogin(Guid id, string role) => bank.ControllerContext = new ControllerContext
{
    HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity([
        new Claim(ClaimTypes.NameIdentifier, id.ToString()), new Claim(ClaimTypes.Role, role)], "Test")) }
};
var bankDto = new RentWise.API.Modules.Users.Controllers.BankDetailsDto
{ BankName = "Test Bank", AccountName = "Test Owner", AccountNumber = "001234567890", Branch = "Test Branch" };
BankLogin(tenant.Id, "Tenant");
Check(await bank.Save(bankDto) is ForbidResult, "Tenant cannot change owner bank details");
var missingBank = (OkObjectResult)await bank.ForAgreement(agreement.Id);
Check(!JsonSerializer.SerializeToElement(missingBank.Value).GetProperty("configured").GetBoolean(), "Missing bank account produces an explicit unconfigured response");
BankLogin(owner.Id, "PropertyOwner");
Check(await bank.Save(new RentWise.API.Modules.Users.Controllers.BankDetailsDto()) is BadRequestObjectResult, "Incomplete bank details cannot be saved");
Check(await bank.Save(bankDto) is OkObjectResult, "Owner can save their bank account");
BankLogin(stranger.Id, "PropertyOwner");
Check(await bank.ForAgreement(agreement.Id) is NotFoundResult, "Unrelated owner cannot read tenant payment instructions");
BankLogin(tenant.Id, "Tenant");
var transfer = JsonSerializer.SerializeToElement(((OkObjectResult)await bank.ForAgreement(agreement.Id)).Value);
Check(transfer.GetProperty("accountNumber").GetString() == bankDto.AccountNumber, "Tenant receives the agreement owner's saved account, preserving leading zeroes");
Check(!JsonSerializer.SerializeToElement(owner).TryGetProperty("BankAccountNumber", out _), "Generic user serialization does not expose bank account details");
BankLogin(owner.Id, "PropertyOwner"); bankDto.AccountNumber = "009999999999";
await bank.Save(bankDto);
BankLogin(tenant.Id, "Tenant");
transfer = JsonSerializer.SerializeToElement(((OkObjectResult)await bank.ForAgreement(agreement.Id)).Value);
Check(transfer.GetProperty("accountNumber").GetString() == bankDto.AccountNumber, "Owner updates appear in subsequent transfer instructions");
Console.WriteLine($"{checks} workflow and bank-detail checks passed ({(string.IsNullOrEmpty(pgConnection) ? "SQLite" : "PostgreSQL migrations")}; no real LLM or deployment calls).");

class TestDb(DbContextOptions<ApplicationDbContext> options) : ApplicationDbContext(options)
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        // SQLite cannot order decimals natively; production uses PostgreSQL numeric.
        if (Database.IsSqlite()) modelBuilder.Entity<Property>().Property(p => p.MonthlyRent).HasConversion<double>();
    }
}

class FakeAgent(Guid propertyId) : IRentalWorkflowAgentClient
{
    public bool InvalidSelection { get; set; }
    public bool BadTool { get; set; }
    public bool ExtraField { get; set; }
    public bool SawChainedInput { get; private set; }
    public Task<JsonElement> Execute(string role, object input)
    {
        var data = JsonSerializer.SerializeToElement(input, RentalWorkflowRules.Json);
        var index = Array.IndexOf(RentalWorkflowRules.Plan, role);
        if (index > 0)
        {
            if (!data.GetProperty("outputs").TryGetProperty(RentalWorkflowRules.Plan[index - 1], out _)) throw new Exception("Missing previous agent output");
            SawChainedInput = true;
        }
        var output = new Dictionary<string, object> { ["propertyId"] = InvalidSelection ? Guid.NewGuid() : propertyId, ["summary"] = "Validated fixture summary" };
        if (ExtraField) output["approved"] = true;
        if (role == "PropertyVerification") output["eligible"] = true;
        if (role == "AgreementPricing") { output["monthlyRent"] = 50000; output["terms"] = "Non-binding rental draft for owner review."; }
        if (role == "MaintenanceTriage") output["checklist"] = new[] { "Check water supply at handover." };
        return Task.FromResult(JsonSerializer.SerializeToElement(new { output, toolCalls = new[] { new { name = BadTool ? "activate_tenancy" : RentalWorkflowRules.Tools[role], arguments = new { }, result = new { source = "fixture" } } } }));
    }
}
