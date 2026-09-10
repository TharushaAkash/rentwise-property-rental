using RentWise_Backend.DTOs.Search;

namespace RentWise_Backend.Services.Interfaces
{
    public interface ITenantPreferenceService
    {
        Task<PropertySearchDto?> GetSearchPreferencesAsync(
            int tenantProfileId);
    }
}