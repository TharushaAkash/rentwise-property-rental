using System.Collections.Generic;
using System.Threading.Tasks;
using RentWise.API.Modules.PropertyManagement.DTOs;

namespace RentWise.API.Modules.PropertyManagement.Interfaces
{
    public interface IPropertySearchService
    {
        Task<List<PropertySearchResultDto>> SearchAsync(PropertySearchDto searchDto);
    }
}