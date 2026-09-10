using Microsoft.EntityFrameworkCore;
using RentWise_Backend.Data;
using RentWise_Backend.Services;
using RentWise_Backend.Controllers;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers(options => options.Filters.Add<ComponentCExceptionFilter>());
builder.Services.AddScoped<RentalAgreementService>();
builder.Services.AddScoped<PaymentService>();
builder.Services.AddScoped<RentReminderService>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<IAgreementApprovalIntegration, UnavailableAgreementApprovalIntegration>();

// Register AppDbContext with PostgreSQL (Moved BEFORE builder.Build())
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();
