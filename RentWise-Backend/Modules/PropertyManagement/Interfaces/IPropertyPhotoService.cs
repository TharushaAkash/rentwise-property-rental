using RentWise_Backend.Models.PropertyManagement;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace RentWise.API.Modules.PropertyManagement.Interfaces
{
    public interface IPropertyPhotoService
    {
        Task<IEnumerable<PropertyPhoto>> GetAllPhotosAsync(Guid propertyId);
        Task<PropertyPhoto?> GetPhotoByIdAsync(Guid id);
        Task<PropertyPhoto> CreatePhotoAsync(PropertyPhoto photo);
        Task UpdatePhotoAsync(PropertyPhoto photo);
        Task DeletePhotoAsync(Guid id);
    }
}
