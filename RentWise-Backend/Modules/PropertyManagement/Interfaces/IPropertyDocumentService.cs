using RentWise_Backend.Models.PropertyManagement;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace RentWise.API.Modules.PropertyManagement.Interfaces
{
    public interface IPropertyDocumentService
    {
        Task<IEnumerable<PropertyDocument>> GetAllDocumentsAsync(Guid propertyId);
        Task<PropertyDocument?> GetDocumentByIdAsync(Guid id);
        Task<PropertyDocument> CreateDocumentAsync(PropertyDocument document);
        Task UpdateDocumentAsync(PropertyDocument document);
        Task DeleteDocumentAsync(Guid id);
    }
}
