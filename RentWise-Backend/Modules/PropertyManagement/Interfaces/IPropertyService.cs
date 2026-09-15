using RentWise_Backend.Models.PropertyManagement;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace RentWise.API.Modules.PropertyManagement.Interfaces
{
    public interface IPropertyService
    {
        Task<IEnumerable<Property>> GetAllPropertiesAsync();
        Task<Property?> GetPropertyByIdAsync(Guid id);
        Task<IEnumerable<Property>> GetPropertiesByOwnerIdAsync(Guid ownerId);
        Task<Property> CreatePropertyAsync(Property property);
        Task UpdatePropertyAsync(Property property);
        Task DeletePropertyAsync(Guid id);
    }
}
