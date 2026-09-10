using Microsoft.EntityFrameworkCore;
using RentWise_Backend.Data;
using RentWise_Backend.Services;
using RentWise_Backend.Controllers;
using RentWise_Backend.Services.Interfaces;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers(options => options.Filters.Add<ComponentCExceptionFilter>());
builder.Services.AddScoped<RentalAgreementService>();
builder.Services.AddScoped<PaymentService>();
builder.Services.AddScoped<RentReminderService>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<IAgreementApprovalIntegration, UnavailableAgreementApprovalIntegration>();

// Register tenant services.
builder.Services.AddScoped<ITenantProfileService, TenantProfileService>();
builder.Services.AddScoped<ISavedPropertyService, SavedPropertyService>();
builder.Services.AddScoped<IApplicationService, ApplicationService>();
builder.Services.AddScoped<ITenantPreferenceService, TenantPreferenceService>();

// Register database contexts with PostgreSQL.
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();
