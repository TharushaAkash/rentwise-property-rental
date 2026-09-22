using RentWise_Backend.Models.PropertyManagement;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace RentWise_Backend.Services.Interfaces
{
    public interface IPropertyService
    {
        Task<IEnumerable<Property>> GetAllPropertiesAsync();
        Task<Property?> GetPropertyByIdAsync(Guid id);
        Task<IEnumerable<Property>> GetPropertiesByOwnerIdAsync(Guid ownerId);
        Task<RentWise_Backend.Modules.PropertyManagement.DTOs.MarketRentDto> GetMarketRentAsync(string location, string propertyType, int bedrooms);
        Task<Property> CreatePropertyAsync(Property property);
        Task UpdatePropertyAsync(Property property);
        Task<bool> UpdatePropertyStatusAsync(Guid id, PropertyStatus newStatus);
        Task DeletePropertyAsync(Guid id);
    }
}
