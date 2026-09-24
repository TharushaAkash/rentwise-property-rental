using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using RentWise.API.Modules.TenantMatching.Entities;

namespace RentWise.API.Modules.TenantMatching.Interfaces
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
