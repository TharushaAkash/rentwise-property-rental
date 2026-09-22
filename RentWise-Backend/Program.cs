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
builder.Services.AddScoped<IPropertyService, PropertyService>();
builder.Services.AddScoped<IPropertyPhotoService, PropertyPhotoService>();
builder.Services.AddScoped<IPropertyDocumentService, PropertyDocumentService>();
builder.Services.AddScoped<IVerificationRecordService, VerificationRecordService>();

builder.Services.AddScoped<ITenantProfileService, TenantProfileService>();
builder.Services.AddScoped<ISavedPropertyService, SavedPropertyService>();
builder.Services.AddScoped<IApplicationService, ApplicationService>();

builder.Services.AddScoped<IAuthService, AuthService>();

builder.Services.AddScoped<IRentalAgreementService, RentalAgreementService>();
builder.Services.AddScoped<IPaymentService, PaymentService>();
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
builder.Services.AddScoped<ISupabaseStorageService, RentWise.API.Common.Services.SupabaseStorageService>();

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

        // 1. Ensure __EFMigrationsHistory table exists and record applied migrations
        await dbContext.Database.ExecuteSqlRawAsync(@"
            CREATE TABLE IF NOT EXISTS ""__EFMigrationsHistory"" (
                ""MigrationId"" character varying(150) NOT NULL,
                ""ProductVersion"" character varying(32) NOT NULL,
                CONSTRAINT ""PK___EFMigrationsHistory"" PRIMARY KEY (""MigrationId"")
            );

            INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
            VALUES 
                ('20260913050517_InitialCreate', '9.0.0'),
                ('20260913061658_UpdateUserSchema', '9.0.0')
            ON CONFLICT (""MigrationId"") DO NOTHING;
        ");

        // 2. If lowercase 'users' table exists, rename to ""Users""
        await dbContext.Database.ExecuteSqlRawAsync(@"
            DO $$
            BEGIN
              IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
                ALTER TABLE users RENAME TO ""Users"";
              END IF;
            END $$;
        ");

        // 3. Ensure ""Users"" table exists with all required columns
        await dbContext.Database.ExecuteSqlRawAsync(@"
            CREATE TABLE IF NOT EXISTS ""Users"" (
                ""Id"" uuid NOT NULL,
                ""Name"" character varying(150) NOT NULL DEFAULT '',
                ""Email"" character varying(200) NOT NULL,
                ""PasswordHash"" character varying(300) NOT NULL,
                ""Role"" character varying(20) NOT NULL DEFAULT 'Tenant',
                ""PhoneNumber"" character varying(20),
                ""NicNumber"" character varying(20),
                ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ""UpdatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT ""PK_Users"" PRIMARY KEY (""Id"")
            );
        ");

        // 4. Ensure all columns in ""Users"" exist and match expected types
        await dbContext.Database.ExecuteSqlRawAsync(@"
            DO $$
            BEGIN
              -- Name / FullName check
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Users' AND column_name='Name') THEN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Users' AND column_name='FullName') THEN
                  ALTER TABLE ""Users"" RENAME COLUMN ""FullName"" TO ""Name"";
                ELSE
                  ALTER TABLE ""Users"" ADD COLUMN ""Name"" character varying(150) NOT NULL DEFAULT '';
                END IF;
              END IF;

              -- PhoneNumber check
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Users' AND column_name='PhoneNumber') THEN
                ALTER TABLE ""Users"" ADD COLUMN ""PhoneNumber"" character varying(20);
              END IF;

              -- NicNumber check
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Users' AND column_name='NicNumber') THEN
                ALTER TABLE ""Users"" ADD COLUMN ""NicNumber"" character varying(20);
              END IF;

              -- Role varchar check
              IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Users' AND column_name='Role' AND data_type != 'character varying') THEN
                ALTER TABLE ""Users"" ALTER COLUMN ""Role"" TYPE character varying(20) USING ""Role""::text;
              END IF;

              -- IsBlocked check
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='Users' AND column_name='IsBlocked') THEN
                ALTER TABLE ""Users"" ADD COLUMN ""IsBlocked"" boolean NOT NULL DEFAULT false;
              END IF;
            END $$;
        ");

        // 4b. Ensure Properties table and all columns exist
        try
        {
            await dbContext.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""Properties"" (
                    ""Id"" uuid NOT NULL,
                    ""OwnerId"" uuid NOT NULL,
                    ""Title"" text NOT NULL DEFAULT '',
                    ""Description"" text NOT NULL DEFAULT '',
                    ""Address"" text NOT NULL DEFAULT '',
                    ""MonthlyRent"" numeric NOT NULL DEFAULT 0,
                    ""Bedrooms"" integer NOT NULL DEFAULT 0,
                    ""Bathrooms"" integer NOT NULL DEFAULT 0,
                    ""Facilities"" text NOT NULL DEFAULT '',
                    ""Sqft"" integer NOT NULL DEFAULT 0,
                    ""PropertyType"" text NOT NULL DEFAULT 'House',
                    ""FeatureTags"" text[] NOT NULL DEFAULT '{}',
                    ""PhotoCount"" integer NOT NULL DEFAULT 0,
                    ""Status"" integer NOT NULL DEFAULT 0,
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""UpdatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT ""PK_Properties"" PRIMARY KEY (""Id"")
                );

                -- Foreign key to Users
                DO $$
                BEGIN
                  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Users' AND table_schema = 'public') THEN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Properties_Users_OwnerId') THEN
                      ALTER TABLE ""Properties"" ADD CONSTRAINT ""FK_Properties_Users_OwnerId"" 
                      FOREIGN KEY (""OwnerId"") REFERENCES ""Users"" (""Id"") ON DELETE RESTRICT;
                    END IF;
                  END IF;
                END $$;

                ALTER TABLE IF EXISTS ""Properties"" ADD COLUMN IF NOT EXISTS ""Sqft"" integer NOT NULL DEFAULT 0;
                ALTER TABLE IF EXISTS ""Properties"" ADD COLUMN IF NOT EXISTS ""PropertyType"" text NOT NULL DEFAULT 'House';
                ALTER TABLE IF EXISTS ""Properties"" ADD COLUMN IF NOT EXISTS ""FeatureTags"" text[] NOT NULL DEFAULT '{}';
                ALTER TABLE IF EXISTS ""Properties"" ADD COLUMN IF NOT EXISTS ""PhotoCount"" integer NOT NULL DEFAULT 0;

                CREATE TABLE IF NOT EXISTS ""PropertyPhotos"" (
                    ""Id"" uuid NOT NULL,
                    ""PropertyId"" uuid NOT NULL,
                    ""PhotoUrl"" text NOT NULL DEFAULT '',
                    ""IsPrimary"" boolean NOT NULL DEFAULT false,
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""UpdatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT ""PK_PropertyPhotos"" PRIMARY KEY (""Id"")
                );

                DO $$
                BEGIN
                  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_PropertyPhotos_Properties_PropertyId') THEN
                    ALTER TABLE ""PropertyPhotos"" ADD CONSTRAINT ""FK_PropertyPhotos_Properties_PropertyId"" 
                    FOREIGN KEY (""PropertyId"") REFERENCES ""Properties"" (""Id"") ON DELETE CASCADE;
                  END IF;
                END $$;

                CREATE TABLE IF NOT EXISTS ""PropertyDocuments"" (
                    ""Id"" uuid NOT NULL,
                    ""PropertyId"" uuid NOT NULL,
                    ""DocumentType"" text NOT NULL DEFAULT '',
                    ""DocumentUrl"" text NOT NULL DEFAULT '',
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""UpdatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT ""PK_PropertyDocuments"" PRIMARY KEY (""Id"")
                );

                DO $$
                BEGIN
                  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_PropertyDocuments_Properties_PropertyId') THEN
                    ALTER TABLE ""PropertyDocuments"" ADD CONSTRAINT ""FK_PropertyDocuments_Properties_PropertyId"" 
                    FOREIGN KEY (""PropertyId"") REFERENCES ""Properties"" (""Id"") ON DELETE CASCADE;
                  END IF;
                END $$;

                CREATE TABLE IF NOT EXISTS ""VerificationRecords"" (
                    ""Id"" uuid NOT NULL,
                    ""PropertyId"" uuid NOT NULL,
                    ""AdminId"" uuid,
                    ""IsApproved"" boolean NOT NULL DEFAULT false,
                    ""Comments"" text NOT NULL DEFAULT '',
                    ""AgentReport"" text NOT NULL DEFAULT '',
                    ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""UpdatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT ""PK_VerificationRecords"" PRIMARY KEY (""Id"")
                );

                DO $$
                BEGIN
                  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_VerificationRecords_Properties_PropertyId') THEN
                    ALTER TABLE ""VerificationRecords"" ADD CONSTRAINT ""FK_VerificationRecords_Properties_PropertyId"" 
                    FOREIGN KEY (""PropertyId"") REFERENCES ""Properties"" (""Id"") ON DELETE CASCADE;
                  END IF;
                END $$;
            ");
            Console.WriteLine("[Database] Successfully ensured Properties, PropertyPhotos, and related tables exist.");
        }
        catch (Exception propEx)
        {
            Console.WriteLine($"[Database Warning] Properties columns sync: {propEx.Message}");
        }

        // 5. Automatically create any missing tables (Properties, RentalAgreements, MaintenanceRequests, etc.)
        var databaseCreator = dbContext.Database.GetService<IDatabaseCreator>() as IRelationalDatabaseCreator;
        if (databaseCreator != null)
        {
            var rawScript = databaseCreator.GenerateCreateScript();

            // Transform CREATE TABLE -> CREATE TABLE IF NOT EXISTS
            var safeScript = Regex.Replace(
                rawScript,
                @"\bCREATE\s+TABLE\b",
                "CREATE TABLE IF NOT EXISTS",
                RegexOptions.IgnoreCase
            );

            // Transform CREATE INDEX -> CREATE INDEX IF NOT EXISTS
            safeScript = Regex.Replace(
                safeScript,
                @"\bCREATE\s+(UNIQUE\s+)?INDEX\b",
                "CREATE $1INDEX IF NOT EXISTS",
                RegexOptions.IgnoreCase
            );

            // Split and execute statements safely
            var statements = safeScript.Split(new[] { ";\r\n", ";\n", ";\r" }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var stmt in statements)
            {
                var trimmed = stmt.Trim();
                if (string.IsNullOrWhiteSpace(trimmed)) continue;

                try
                {
                    await dbContext.Database.ExecuteSqlRawAsync(trimmed + ";");
                }
                catch
                {
                    // Ignore already existing constraints or indexes
                }
            }
        }

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
    await client.InitializeAsync();
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
app.UseAuthorization();

app.MapControllers();

app.Run();
