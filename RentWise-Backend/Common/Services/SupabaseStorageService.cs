using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using RentWise_Backend.Common.Interfaces;
using System;
using System.IO;
using System.Threading.Tasks;
using Supabase;

namespace RentWise_Backend.Common.Services
{
    public class SupabaseStorageService : ISupabaseStorageService
    {
        private readonly Client _supabaseClient;
        private readonly ILogger<SupabaseStorageService> _logger;

        public SupabaseStorageService(Client supabaseClient, ILogger<SupabaseStorageService> logger)
        {
            _supabaseClient = supabaseClient;
            _logger = logger;
        }

        public async Task<string> UploadFileAsync(IFormFile file, string bucketName, string filePath)
        {
            try
            {
                if (file == null || file.Length == 0)
                {
                    throw new ArgumentException("File is empty or null.", nameof(file));
                }

                using var memoryStream = new MemoryStream();
                await file.CopyToAsync(memoryStream);
                var byteData = memoryStream.ToArray();

                // Upload to Supabase Storage
                var storage = _supabaseClient.Storage.From(bucketName);
                
                // Set the file options, such as cache control, upsert
                var options = new Supabase.Storage.FileOptions
                {
                    CacheControl = "3600",
                    Upsert = true
                };

                await storage.Upload(byteData, filePath, options);

                // Get public URL
                var publicUrl = storage.GetPublicUrl(filePath);
                
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
                var storage = _supabaseClient.Storage.From(bucketName);
                await storage.Remove(new System.Collections.Generic.List<string> { filePath });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting file {FilePath} from Supabase bucket {BucketName}", filePath, bucketName);
                throw;
            }
        }
    }
}
