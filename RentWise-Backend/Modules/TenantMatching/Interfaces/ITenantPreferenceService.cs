using RentWise.API.Modules.TenantMatching.DTOs;

namespace RentWise.API.Modules.TenantMatching.Interfaces
{
    public interface ITenantPreferenceService
    {
        Task<PropertySearchDto?> GetSearchPreferencesAsync(
            int tenantProfileId);
    }
}
