using RentWise_Backend.DTOs.Tenant;
using RentWise_Backend.Models;
namespace RentWise_Backend.Services.Interfaces
{
    public interface ITenantProfileService
    {
        Task<TenantProfile?> GetByUserIdAsync(Guid userId);
        Task<TenantProfile> CreateAsync(
            CreateTenantProfileDto dto);
        Task<TenantProfile?> UpdateAsync(
            Guid userId,
            UpdateTenantProfileDto dto);
        Task<bool> DeleteAsync(Guid userId);
    }
}
