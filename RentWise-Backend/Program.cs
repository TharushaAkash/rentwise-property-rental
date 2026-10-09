using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.EntityFrameworkCore.Infrastructure;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using RentWise.API.Data;
using RentWise.API.Common.Interfaces;
using RentWise.API.Common.Repositories;
using RentWise.API.Modules.PropertyManagement.Interfaces;
using RentWise.API.Modules.PropertyManagement.Services;
using RentWise.API.Modules.TenantMatching.Interfaces;
using RentWise.API.Modules.TenantMatching.Services;
using RentWise.API.Modules.Agreements.Interfaces;
using RentWise.API.Modules.Agreements.Services;
using RentWise.API.Modules.Maintenance.Interfaces;
using RentWise.API.Modules.Maintenance.Services;
using RentWise.API.Modules.Users.Services;
using RentWise.API.Common.Services;
using Supabase;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
DotNetEnv.Env.Load();

// Add services to the container.
builder.Services.AddControllers(options =>
{
    options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true;
})
.AddJsonOptions(options =>
{
    options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
    options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
});
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp",
        policy => policy.AllowAnyOrigin()
                        .AllowAnyHeader()
                        .AllowAnyMethod());
});

builder.Services.AddSwaggerGen(c =>
{
    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "JWT Authorization header using the Bearer scheme.\n\nEnter your token in the text input below.\n\nExample: '1safsfsdfdfd'"
    });
    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Register Generic Repository
builder.Services.AddScoped(typeof(IRepository<>), typeof(Repository<>));

// Register Module Services
builder.Services.AddScoped<RentWise.API.Modules.AgenticAI.Services.IRentalWorkflowAgentClient, RentWise.API.Modules.AgenticAI.Services.RentalWorkflowAgentClient>();
builder.Services.AddScoped<RentWise.API.Modules.AgenticAI.Services.RentalWorkflowService>();
builder.Services.AddScoped<IPropertyService, PropertyService>();
builder.Services.AddScoped<IPropertyPhotoService, PropertyPhotoService>();
builder.Services.AddScoped<IPropertyDocumentService, PropertyDocumentService>();
builder.Services.AddScoped<IVerificationRecordService, VerificationRecordService>();

builder.Services.AddScoped<ITenantProfileService, TenantProfileService>();
builder.Services.AddScoped<ISavedPropertyService, SavedPropertyService>();
builder.Services.AddScoped<IApplicationService, ApplicationService>();

builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddSingleton<PasswordResetStore>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<IPasswordResetEmailSender, PasswordResetEmailSender>();
builder.Services.AddScoped<PasswordResetService>();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("password-reset", context =>
        System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
            {
                PermitLimit = 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0
            }));
});

builder.Services.AddScoped<IRentalAgreementService, RentalAgreementService>();
builder.Services.AddScoped<IPaymentService, PaymentService>();
builder.Services.AddScoped<IBookingConfirmationEmailSender, BookingConfirmationEmailSender>();
builder.Services.AddScoped<IRentReminderService, RentReminderService>();

builder.Services.AddScoped<IMaintenanceRequestService, MaintenanceRequestService>();
builder.Services.AddScoped<IServiceProviderService, ServiceProviderService>();
builder.Services.AddScoped<IRequestStatusLogService, RequestStatusLogService>();

// Configure Supabase
var supabaseUrl = Environment.GetEnvironmentVariable("SUPABASE_URL") ?? builder.Configuration["Supabase:Url"] ?? "https://placeholder.supabase.co";
var supabaseKey = Environment.GetEnvironmentVariable("SUPABASE_SECRET_KEY") ?? builder.Configuration["Supabase:SecretKey"] ?? "placeholder-secret-key";
var supabaseOptions = new SupabaseOptions { AutoConnectRealtime = true };
var supabaseClient = new Supabase.Client(supabaseUrl, supabaseKey, supabaseOptions);
builder.Services.AddSingleton(supabaseClient);
builder.Services.AddHttpClient<ISupabaseStorageService, RentWise.API.Common.Services.SupabaseStorageService>();

// Named HttpClient for the Agentic AI proxy — 120s timeout to allow for Gemini ReAct loops
builder.Services.AddHttpClient("AgenticProxy", client =>
{
    client.Timeout = TimeSpan.FromSeconds(120);
});

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key not found.")))
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

// Auto-initialize Database and synchronize schema
// Assessment hosts initialize their disposable database explicitly and avoid external startup calls.
if (!app.Environment.IsEnvironment("Testing"))
using (var scope = app.Services.CreateScope())
{
    try
    {
        // 0. Ensure target database exists in PostgreSQL (connects via default 'postgres' database)
        try
        {
            var rawConnStr = builder.Configuration.GetConnectionString("DefaultConnection") ?? "";
            var connBuilder = new NpgsqlConnectionStringBuilder(rawConnStr);
            var targetDbName = connBuilder.Database;

            if (!string.IsNullOrWhiteSpace(targetDbName))
            {
                var masterConnBuilder = new NpgsqlConnectionStringBuilder(rawConnStr)
                {
                    Database = "postgres"
                };

                using var masterConn = new NpgsqlConnection(masterConnBuilder.ConnectionString);
                await masterConn.OpenAsync();

                using var checkCmd = new NpgsqlCommand("SELECT 1 FROM pg_database WHERE datname = @dbName;", masterConn);
                checkCmd.Parameters.AddWithValue("dbName", targetDbName);
                var dbExists = await checkCmd.ExecuteScalarAsync();

                if (dbExists == null)
                {
                    Console.WriteLine($"[Database] Target database '{targetDbName}' was not found. Creating database automatically...");
                    using var createCmd = new NpgsqlCommand($"CREATE DATABASE \"{targetDbName}\";", masterConn);
                    await createCmd.ExecuteNonQueryAsync();
                    Console.WriteLine($"[Database] Successfully created database '{targetDbName}'.");
                }
            }
        }
        catch (Exception dbCreateEx)
        {
            Console.WriteLine($"[Database Note] Database auto-creation check: {dbCreateEx.Message}");
        }

        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // 5. Automatically apply EF Core Migrations
        await dbContext.Database.MigrateAsync();

        Console.WriteLine("[Database] Auto-migration and all database tables (Users, Properties, etc.) verified/created successfully.");

        // 6. Ensure default Administrator user exists (admin@rentwise.com / AdminPassword123!)
        try
        {
            var adminEmail = "admin@rentwise.com";
            var existingAdmin = await dbContext.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == adminEmail);
            if (existingAdmin == null)
            {
                var adminUser = new RentWise.API.Modules.Users.User
                {
                    Id = Guid.NewGuid(),
                    Name = "System Administrator",
                    Email = adminEmail,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("AdminPassword123!"),
                    Role = "Administrator",
                    PhoneNumber = "0771234567",
                    NicNumber = "198512345678",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                dbContext.Users.Add(adminUser);
                await dbContext.SaveChangesAsync();
                Console.WriteLine("[Database] Seeded default Administrator: admin@rentwise.com / AdminPassword123!");
            }
            else
            {
                bool modified = false;
                if (existingAdmin.Role != "Administrator")
                {
                    existingAdmin.Role = "Administrator";
                    modified = true;
                }
                if (string.IsNullOrWhiteSpace(existingAdmin.PasswordHash))
                {
                    existingAdmin.PasswordHash = BCrypt.Net.BCrypt.HashPassword("AdminPassword123!");
                    modified = true;
                }
                if (modified)
                {
                    await dbContext.SaveChangesAsync();
                }
                Console.WriteLine("[Database] Verified default Administrator account: admin@rentwise.com");
            }

            // 6.5. Ensure Supabase NICs Bucket Exists
            try
            {
                var supaClient = scope.ServiceProvider.GetRequiredService<Supabase.Client>();
                await supaClient.InitializeAsync();
                
                // We attempt to get the bucket. If it fails or returns null, we create it.
                var buckets = await supaClient.Storage.ListBuckets();
                if (buckets == null || !buckets.Any(b => b.Name == "NICs"))
                {
                    await supaClient.Storage.CreateBucket("NICs", new Supabase.Storage.BucketUpsertOptions { Public = true });
                    Console.WriteLine("[Supabase] Created 'NICs' storage bucket.");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Supabase Note] Ensure NICs bucket exists failed: {ex.Message}");
            }

            // 7. Ensure default verified property exists (26270925-f600-48af-8b7d-43d01545c40f)
            try
            {
                var defaultPropId = Guid.Parse("26270925-f600-48af-8b7d-43d01545c40f");
                var adminUser = await dbContext.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == "admin@rentwise.com");
                var existingProp = await dbContext.Properties.Include(p => p.Photos).FirstOrDefaultAsync(p => p.Id == defaultPropId);
                
                if (existingProp == null)
                {
                    var prop = new RentWise.API.Modules.PropertyManagement.Entities.Property
                    {
                        Id = defaultPropId,
                        OwnerId = adminUser != null ? adminUser.Id : Guid.NewGuid(),
                        Title = "Brand New Luxury House for Rent in Thalangama - Battaramulla",
                        Description = "Brand new architect-designed modern 5-bedroom luxury residence located in Thalangama, Battaramulla. Features expansive living spaces, private landscaped garden, rooftop terrace, solar hot water, 3-phase electricity, CCTV security system, and double garage with automated roller gate.",
                        Address = "Thalangama North, Battaramulla, Colombo",
                        MonthlyRent = 275000,
                        Bedrooms = 5,
                        Bathrooms = 4,
                        Sqft = 5000,
                        PropertyType = "House",
                        Facilities = "Air Conditioning, Hot Water, Swimming Pool, Parking / Garage, Security System, CCTV, Garden, Rooftop Terrace, 3-Phase Electricity, Furnished",
                        FeatureTags = new List<string> { "Verified Luxury", "Solar Powered", "Prime Location" },
                        PhotoCount = 4,
                        Status = RentWise.API.Modules.PropertyManagement.Entities.PropertyStatus.Active,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };

                    dbContext.Properties.Add(prop);
                    await dbContext.SaveChangesAsync();

                    var photos = new List<RentWise.API.Modules.PropertyManagement.Entities.PropertyPhoto>
                    {
                        new() { Id = Guid.NewGuid(), PropertyId = defaultPropId, PhotoUrl = "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80", IsPrimary = true, CreatedAt = DateTime.UtcNow },
                        new() { Id = Guid.NewGuid(), PropertyId = defaultPropId, PhotoUrl = "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80", IsPrimary = false, CreatedAt = DateTime.UtcNow },
                        new() { Id = Guid.NewGuid(), PropertyId = defaultPropId, PhotoUrl = "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1200&q=80", IsPrimary = false, CreatedAt = DateTime.UtcNow },
                        new() { Id = Guid.NewGuid(), PropertyId = defaultPropId, PhotoUrl = "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80", IsPrimary = false, CreatedAt = DateTime.UtcNow }
                    };

                    dbContext.PropertyPhotos.AddRange(photos);
                    await dbContext.SaveChangesAsync();
                    Console.WriteLine($"[Database] Seeded target property: {defaultPropId}");
                }
            }
            catch (Exception propSeedEx)
            {
                Console.WriteLine($"[Database Warning] Property seeding: {propSeedEx.Message}");
            }
        }
        catch (Exception seedEx)
        {
            Console.WriteLine($"[Database Warning] Admin user seeding: {seedEx.Message}");
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Database Warning] Schema auto-sync: {ex.Message}");
    }

    // Initialize Supabase Client
    var client = scope.ServiceProvider.GetRequiredService<Supabase.Client>();
    try
    {
        await client.InitializeAsync();
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Supabase Warning] Initialization failed: {ex.Message}");
    }
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseCors("AllowReactApp");

app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

app.MapControllers();

app.Run();

public partial class Program { }
