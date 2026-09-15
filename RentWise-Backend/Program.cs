using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using RentWise_Backend.Data;
using RentWise_Backend.Services;
using RentWise_Backend.Services.Interfaces;
using RentWise.API.Modules.PropertyManagement.Interfaces;
using RentWise.API.Modules.PropertyManagement.Services;
using RentWise_Backend.Common.Interfaces;
// using RentWise_Backend.Common.Repositories;
using RentWise_Backend.Common.Services;
using Supabase;

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

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Register Generic Repository
// builder.Services.AddScoped(typeof(IRepository<>), typeof(Repository<>));

// Register Module Services
builder.Services.AddScoped<IPropertyService, PropertyService>();
builder.Services.AddScoped<IPropertyPhotoService, PropertyPhotoService>();
// builder.Services.AddScoped<IPropertyDocumentService, PropertyDocumentService>();
// builder.Services.AddScoped<IVerificationRecordService, VerificationRecordService>();

builder.Services.AddScoped<ITenantProfileService, TenantProfileService>();
builder.Services.AddScoped<ISavedPropertyService, SavedPropertyService>();
builder.Services.AddScoped<IApplicationService, ApplicationService>();

builder.Services.AddScoped<IAuthService, AuthService>();

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<IAgreementApprovalIntegration, UnavailableAgreementApprovalIntegration>();
builder.Services.AddScoped<RentalAgreementService>();
builder.Services.AddScoped<PaymentService>();
builder.Services.AddScoped<RentReminderService>();

// builder.Services.AddScoped<IMaintenanceRequestService, MaintenanceRequestService>();
// builder.Services.AddScoped<IServiceProviderService, ServiceProviderService>();
// builder.Services.AddScoped<IRequestStatusLogService, RequestStatusLogService>();

// Configure Supabase
var supabaseUrl = Environment.GetEnvironmentVariable("SUPABASE_URL") ?? builder.Configuration["Supabase:Url"];
var supabaseKey = Environment.GetEnvironmentVariable("SUPABASE_SECRET_KEY") ?? builder.Configuration["Supabase:SecretKey"];
var supabaseOptions = new SupabaseOptions { AutoConnectRealtime = true };
var supabaseClient = new Supabase.Client(supabaseUrl, supabaseKey, supabaseOptions);
builder.Services.AddSingleton(supabaseClient);
builder.Services.AddScoped<ISupabaseStorageService, RentWise_Backend.Common.Services.SupabaseStorageService>();

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

// Initialize Supabase Client
using (var scope = app.Services.CreateScope())
{
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
