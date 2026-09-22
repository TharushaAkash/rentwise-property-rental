using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using RentWise.API.Common.Interfaces;
using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;

namespace RentWise.API.Common.Services
{
    public class SupabaseStorageService : ISupabaseStorageService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<SupabaseStorageService> _logger;
        private readonly string _supabaseUrl;
        private readonly string _supabaseKey;

        public SupabaseStorageService(HttpClient httpClient, IConfiguration configuration, ILogger<SupabaseStorageService> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
            _supabaseUrl = Environment.GetEnvironmentVariable("SUPABASE_URL") ?? configuration["Supabase:Url"] ?? string.Empty;
            _supabaseKey = Environment.GetEnvironmentVariable("SUPABASE_SECRET_KEY") ?? configuration["Supabase:SecretKey"] ?? string.Empty;

            if (string.IsNullOrEmpty(_supabaseUrl) || string.IsNullOrEmpty(_supabaseKey))
            {
                _logger.LogWarning("Supabase URL or Key is not configured properly.");
            }
        }

        public async Task<string> UploadFileAsync(IFormFile file, string bucketName, string filePath)
        {
            try
            {
                if (file == null || file.Length == 0)
                {
                    throw new ArgumentException("File is empty or null.", nameof(file));
                }

                var url = $"{_supabaseUrl.TrimEnd('/')}/storage/v1/object/{bucketName}/{filePath}";

                using var request = new HttpRequestMessage(HttpMethod.Post, url);
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _supabaseKey);
                request.Headers.Add("apikey", _supabaseKey);

                using var memoryStream = new MemoryStream();
                await file.CopyToAsync(memoryStream);
                var byteData = memoryStream.ToArray();

                var content = new ByteArrayContent(byteData);
                content.Headers.ContentType = new MediaTypeHeaderValue(file.ContentType ?? "application/octet-stream");
                
                // For Supabase upsert option
                request.Headers.Add("x-upsert", "true");

                request.Content = content;

                var response = await _httpClient.SendAsync(request);
                if (!response.IsSuccessStatusCode)
                {
                    var errorResponse = await response.Content.ReadAsStringAsync();
                    throw new Exception($"Supabase Storage returned {response.StatusCode}: {errorResponse}");
                }

                var publicUrl = $"{_supabaseUrl.TrimEnd('/')}/storage/v1/object/public/{bucketName}/{filePath}";
                return publicUrl;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading file {FilePath} to Supabase bucket {BucketName}", filePath, bucketName);
                throw;
            }
        }

        public async Task DeleteFileAsync(string bucketName, string filePath)
        {
            try
            {
                var url = $"{_supabaseUrl.TrimEnd('/')}/storage/v1/object/{bucketName}/{filePath}";

                using var request = new HttpRequestMessage(HttpMethod.Delete, url);
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _supabaseKey);
                request.Headers.Add("apikey", _supabaseKey);

                var response = await _httpClient.SendAsync(request);
                response.EnsureSuccessStatusCode();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting file {FilePath} from Supabase bucket {BucketName}", filePath, bucketName);
                throw;
            }
        }
    }
}
