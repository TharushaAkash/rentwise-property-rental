using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Tokens;
using RentWise.API.Data;
using RentWise.API.Modules.Users;
using RentWise.API.Modules.PropertyManagement.Entities;
using Testcontainers.PostgreSql;

namespace BackendAssessment.Support;

public sealed class AssessmentFactory(string connectionString) : WebApplicationFactory<Program>
{
    public const string Key = "assessment-only-signing-key-at-least-32-bytes-long";
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?> {
            ["ConnectionStrings:DefaultConnection"] = connectionString,
            ["Jwt:Key"] = Key, ["Jwt:Issuer"] = "assessment", ["Jwt:Audience"] = "assessment",
        }));
        builder.ConfigureTestServices(services => {
            services.RemoveAll<ApplicationDbContext>();
            services.RemoveAll<DbContextOptions<ApplicationDbContext>>();
            services.AddDbContext<ApplicationDbContext>(options => options.UseNpgsql(connectionString));
            // Explicit test signing configuration retains the real JwtBearer authentication handler.
            services.PostConfigure<Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerOptions>(
                Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme, options => {
                    options.TokenValidationParameters = new TokenValidationParameters {
                        ValidateIssuer = true, ValidateAudience = true, ValidateLifetime = true,
                        ValidateIssuerSigningKey = true, ValidIssuer = "assessment", ValidAudience = "assessment",
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Key)),
                    };
                });
        });
    }
    public HttpClient AsGuest() => CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
    public HttpClient AsUser(Guid id, string role)
    {
        var client = CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
        var jwt = new JwtSecurityToken("assessment", "assessment", new[] {
            new Claim(JwtRegisteredClaimNames.Sub, id.ToString()), new Claim(ClaimTypes.Role, role),
        }, expires: DateTime.UtcNow.AddMinutes(10), signingCredentials:
            new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Key)), SecurityAlgorithms.HmacSha256));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", new JwtSecurityTokenHandler().WriteToken(jwt));
        return client;
    }
}

public sealed class PostgreSqlFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine").WithDatabase("rentwise_assessment")
        .WithUsername("assessment").WithPassword("assessment-local-only").Build();
    public AssessmentFactory Factory { get; private set; } = null!;
    public string ConnectionString => _postgres.GetConnectionString();
    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();
        Factory = new AssessmentFactory(ConnectionString);
        using var scope = Factory.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.MigrateAsync();
    }
    public ApplicationDbContext OpenDb() => new(new DbContextOptionsBuilder<ApplicationDbContext>().UseNpgsql(ConnectionString).Options);
    public async Task DisposeAsync() { if (Factory != null) await Factory.DisposeAsync(); await _postgres.DisposeAsync(); }
    public async Task<(User Owner, User Tenant, Property Property)> SeedAsync(string? location = null)
    {
        await using var db = OpenDb();
        var owner = new User { Name = "Assessment Owner", Email = $"owner-{Guid.NewGuid():N}@example.test", Role = "PropertyOwner", PasswordHash = "not-a-login-password" };
        var tenant = new User { Name = "Assessment Tenant", Email = $"tenant-{Guid.NewGuid():N}@example.test", Role = "Tenant", PasswordHash = "not-a-login-password" };
        var property = new Property { OwnerId = owner.Id, Title = "Assessment Garden House", Description = "Spacious garden house", Address = location ?? $"Assessment-{Guid.NewGuid():N}", MonthlyRent = 50000, Bedrooms = 3, Bathrooms = 2, Sqft = 1200, PropertyType = "House", Status = PropertyStatus.Active };
        db.Users.AddRange(owner, tenant);
        db.Properties.Add(property);
        db.VerificationRecords.Add(new VerificationRecord { PropertyId = property.Id, Comments = "[LISTING_FEE_PAID: test receipt]", IsApproved = true });
        await db.SaveChangesAsync();
        return (owner, tenant, property);
    }
}
[CollectionDefinition("PostgreSQL assessment", DisableParallelization = true)]
public sealed class PostgreSqlCollection : ICollectionFixture<PostgreSqlFixture> { }
