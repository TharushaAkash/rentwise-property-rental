using Microsoft.AspNetCore.Http;
using System.Threading.Tasks;

namespace RentWise_Backend.Common.Interfaces
{
    public interface ISupabaseStorageService
    {
        Task<string> UploadFileAsync(IFormFile file, string bucketName, string filePath);
        Task DeleteFileAsync(string bucketName, string filePath);
    }
}
