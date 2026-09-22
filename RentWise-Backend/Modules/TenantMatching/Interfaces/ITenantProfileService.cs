using RentWise.API.Modules.TenantMatching.DTOs;
using RentWise.API.Modules.TenantMatching.Entities;

namespace RentWise.API.Modules.TenantMatching.Interfaces
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
