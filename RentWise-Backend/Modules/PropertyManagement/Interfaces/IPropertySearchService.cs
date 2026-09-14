using RentWise_Backend.DTOs.Search;

namespace RentWise_Backend.Services.Interfaces
{
    public interface IPropertySearchService
    {
        Task<List<PropertySearchResultDto>> SearchAsync(
            PropertySearchDto searchDto);
    }
}