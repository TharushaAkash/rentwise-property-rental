using RentWise.API.Modules.TenantMatching.Entities;

namespace RentWise.API.Modules.TenantMatching.Interfaces
{
    public interface ISavedPropertyService
    {
        Task<List<SavedProperty>> GetSavedPropertiesAsync(
            int tenantProfileId);

        Task<SavedProperty> SavePropertyAsync(
            int tenantProfileId,
            int propertyId);

        Task<bool> RemoveSavedPropertyAsync(
            int tenantProfileId,
            int propertyId);
    }
}
