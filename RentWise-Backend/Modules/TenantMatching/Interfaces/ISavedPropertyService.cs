using RentWise_Backend.Models;

namespace RentWise_Backend.Services.Interfaces
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