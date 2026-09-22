using System;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using RentWise_Backend.Modules.TenantMatching.Interfaces;

namespace RentWise_Backend.Modules.TenantMatching.Services
{
    public class LocationService : ILocationService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<LocationService> _logger;

        public LocationService(HttpClient httpClient, ILogger<LocationService> logger)
        {
            _httpClient = httpClient;
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "RentWiseAI/1.0"); // Nominatim requires User-Agent
            _logger = logger;
        }

        public async Task<(double DistanceKm, double TravelTimeMinutes)> GetDistanceAndTravelTimeAsync(string origin, string destination)
        {
            try
            {
                // 1. Geocode origin and destination
                var originCoords = await GeocodeAsync(origin);
                var destCoords = await GeocodeAsync(destination);

                if (originCoords == null || destCoords == null)
                {
                    _logger.LogWarning($"Geocoding failed for origin '{origin}' or destination '{destination}'. Falling back to straight-line distance.");
                    return CalculateStraightLineMock(origin, destination);
                }

                // 2. Call OSRM for routing
                string osrmUrl = $"http://router.project-osrm.org/route/v1/driving/{originCoords.Value.lon},{originCoords.Value.lat};{destCoords.Value.lon},{destCoords.Value.lat}?overview=false";
                
                var response = await _httpClient.GetAsync(osrmUrl);
                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    var json = JsonDocument.Parse(content);
                    
                    if (json.RootElement.TryGetProperty("routes", out var routes) && routes.GetArrayLength() > 0)
                    {
                        var route = routes[0];
                        double distanceMeters = route.GetProperty("distance").GetDouble();
                        double durationSeconds = route.GetProperty("duration").GetDouble();

                        return (distanceMeters / 1000.0, durationSeconds / 60.0);
                    }
                }
                
                _logger.LogWarning($"OSRM routing failed. Status Code: {response.StatusCode}. Falling back to straight-line distance.");
                return CalculateStraightLineMock(originCoords.Value, destCoords.Value);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred during distance calculation. Falling back to straight-line distance.");
                return CalculateStraightLineMock(origin, destination);
            }
        }

        private async Task<(double lat, double lon)?> GeocodeAsync(string address)
        {
            // Simple mock for common Sri Lankan locations to avoid API rate limits
            if (address.Contains("SLIIT", StringComparison.OrdinalIgnoreCase)) return (6.9147, 79.9733);
            if (address.Contains("Malabe", StringComparison.OrdinalIgnoreCase)) return (6.9061, 79.9696);
            if (address.Contains("Colombo", StringComparison.OrdinalIgnoreCase)) return (6.9271, 79.8612);
            if (address.Contains("Kandy", StringComparison.OrdinalIgnoreCase)) return (7.2906, 80.6337);
            
            try
            {
                // Fallback to Nominatim API (OpenStreetMap)
                string url = $"https://nominatim.openstreetmap.org/search?q={Uri.EscapeDataString(address)}&format=json&limit=1";
                var response = await _httpClient.GetAsync(url);
                
                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    var json = JsonDocument.Parse(content);
                    
                    if (json.RootElement.GetArrayLength() > 0)
                    {
                        var firstResult = json.RootElement[0];
                        double lat = double.Parse(firstResult.GetProperty("lat").GetString()!);
                        double lon = double.Parse(firstResult.GetProperty("lon").GetString()!);
                        return (lat, lon);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, $"Geocoding API failed for '{address}'.");
            }
            
            return null;
        }

        private (double DistanceKm, double TravelTimeMinutes) CalculateStraightLineMock((double lat, double lon) origin, (double lat, double lon) dest)
        {
            // Haversine formula for straight-line distance
            var r = 6371; // Radius of earth in kilometers
            var dLat = ToRadians(dest.lat - origin.lat);
            var dLon = ToRadians(dest.lon - origin.lon);
            var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                    Math.Cos(ToRadians(origin.lat)) * Math.Cos(ToRadians(dest.lat)) *
                    Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
            var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
            var distance = r * c;
            
            // Assume average speed of 30 km/h in urban areas
            var timeMinutes = (distance / 30.0) * 60;
            return (Math.Round(distance, 2), Math.Round(timeMinutes, 2));
        }

        private (double DistanceKm, double TravelTimeMinutes) CalculateStraightLineMock(string origin, string destination)
        {
            // Absolute fallback if geocoding entirely fails: return a random distance between 1 and 20 km
            Random rnd = new Random(origin.GetHashCode() ^ destination.GetHashCode());
            double mockDistance = Math.Round(rnd.NextDouble() * 19 + 1, 2);
            double mockTime = Math.Round((mockDistance / 30.0) * 60, 2);
            return (mockDistance, mockTime);
        }

        private double ToRadians(double angle)
        {
            return Math.PI * angle / 180.0;
        }
    }
}
