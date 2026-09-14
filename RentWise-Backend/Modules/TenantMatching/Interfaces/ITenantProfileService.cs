using RentWise_Backend.DTOs.Tenant;
using RentWise_Backend.Models;

namespace RentWise_Backend.Services.Interfaces
{
    public interface ITenantProfileService
    {
        Task<TenantProfile?> GetByUserIdAsync(int userId);

        Task<TenantProfile> CreateAsync(
            CreateTenantProfileDto dto);

        Task<TenantProfile?> UpdateAsync(
            int userId,
            UpdateTenantProfileDto dto);
    }
}