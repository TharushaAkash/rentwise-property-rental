using RentWise_Backend.DTOs.Application;
using RentWise_Backend.Models;

namespace RentWise_Backend.Services.Interfaces
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