using Microsoft.EntityFrameworkCore;
using RentWise_Backend.Data;
using RentWise_Backend.Services;
using RentWise_Backend.Services.Interfaces;

var builder = WebApplication.CreateBuilder(args);

// Add controllers
builder.Services.AddControllers();

// Register services
builder.Services.AddScoped<ITenantProfileService, TenantProfileService>();
builder.Services.AddScoped<ISavedPropertyService, SavedPropertyService>();

// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// PostgreSQL database connection
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection")
    )
);

var app = builder.Build();

// Swagger UI
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();