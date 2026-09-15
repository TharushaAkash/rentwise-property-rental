using RentWise_Backend.DTOs.Application;
using RentWise_Backend.Models;
namespace RentWise_Backend.Services.Interfaces
{
    public interface IApplicationService
    {
        Task<Application> CreateApplicationAsync(
            CreateApplicationDto dto);
        Task<Application?> GetApplicationByIdAsync(
            Guid applicationId);
        Task<List<Application>> GetTenantApplicationsAsync(
            Guid tenantProfileId);
        Task<Application?> UpdateStatusAsync(
            Guid applicationId,
            UpdateApplicationStatusDto dto);
        Task<List<Application>> GetAllApplicationsAsync();
        Task<bool> DeleteApplicationAsync(Guid applicationId);
    }
}
