using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using RentWise.API.Modules.PropertyManagement.Entities;

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
