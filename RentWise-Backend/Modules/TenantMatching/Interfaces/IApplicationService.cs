using RentWise.API.Modules.TenantMatching.DTOs;
using RentWise.API.Modules.TenantMatching.Entities;

namespace RentWise.API.Modules.TenantMatching.Interfaces
{
    public interface IApplicationService
    {
        Task<Application> CreateApplicationAsync(
            CreateApplicationDto dto);

        Task<Application?> GetApplicationByIdAsync(
            int applicationId);

        Task<List<Application>> GetTenantApplicationsAsync(
            int tenantProfileId);

        Task<Application?> UpdateStatusAsync(
            int applicationId,
            UpdateApplicationStatusDto dto);
    }
}
