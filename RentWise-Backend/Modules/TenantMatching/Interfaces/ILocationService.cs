using System.Threading.Tasks;

namespace RentWise_Backend.Modules.TenantMatching.Interfaces
{
    public interface ILocationService
    {
        Task<(double DistanceKm, double TravelTimeMinutes)> GetDistanceAndTravelTimeAsync(string origin, string destination);
    }
}
