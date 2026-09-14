using RentWise_Backend.Models;
namespace RentWise_Backend.Services.Interfaces
{
    public interface ISavedPropertyService
    {
        Task<List<SavedProperty>> GetSavedPropertiesAsync(
            Guid tenantProfileId);
        Task<SavedProperty> SavePropertyAsync(
            Guid tenantProfileId,
            Guid propertyId);
        Task<bool> RemoveSavedPropertyAsync(
            Guid tenantProfileId,
            Guid propertyId);
    }
}
