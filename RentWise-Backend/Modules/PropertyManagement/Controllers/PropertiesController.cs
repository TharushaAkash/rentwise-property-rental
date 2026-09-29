using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RentWise.API.Data;
using RentWise.API.Modules.PropertyManagement.Entities;
using RentWise.API.Modules.PropertyManagement.Interfaces;
using RentWise.API.Modules.PropertyManagement.DTOs;

namespace RentWise.API.Modules.PropertyManagement.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class PropertiesController : ControllerBase
    {
        private readonly IPropertyService _propertyService;
        private readonly ApplicationDbContext _context;
        private readonly IConfiguration _configuration;

        public PropertiesController(IPropertyService propertyService, ApplicationDbContext context, IConfiguration configuration)
        {
            _propertyService = propertyService;
            _context = context;
            _configuration = configuration;
        }

        [AllowAnonymous]
        [HttpGet]
        public async Task<IActionResult> GetProperties()
        {
            var properties = await _propertyService.GetAllPropertiesAsync();
            return Ok(properties);
        }

        [AllowAnonymous]
        [HttpGet("browse")]
        public async Task<IActionResult> Browse([FromQuery] string? location, [FromQuery] decimal? minBudget,
            [FromQuery] decimal? maxBudget, [FromQuery] int? bedrooms, [FromQuery] bool minimumBedrooms = false,
            [FromQuery] string? propertyType = null, [FromQuery] string? cursor = null, [FromQuery] int pageSize = 12)
        {
            if (pageSize < 1 || pageSize > 48 || minBudget < 0 || maxBudget < 0 || bedrooms < 0)
                return BadRequest(new { message = "Invalid search filters." });
            var query = _context.Properties.AsNoTracking().Where(p => p.Status == PropertyStatus.Active);
            if (!string.IsNullOrWhiteSpace(location))
            {
                var term = location.Trim().ToLower();
                query = query.Where(p => p.Address.ToLower().Contains(term) || p.Title.ToLower().Contains(term)
                    || p.Description.ToLower().Contains(term) || p.Facilities.ToLower().Contains(term));
            }
            if (minBudget.HasValue) query = query.Where(p => p.MonthlyRent >= minBudget.Value);
            if (maxBudget.HasValue) query = query.Where(p => p.MonthlyRent <= maxBudget.Value);
            if (bedrooms.HasValue) query = minimumBedrooms
                ? query.Where(p => p.Bedrooms >= bedrooms.Value) : query.Where(p => p.Bedrooms == bedrooms.Value);
            if (!string.IsNullOrWhiteSpace(propertyType))
                query = query.Where(p => p.PropertyType.ToLower() == propertyType.Trim().ToLower());
            if (!string.IsNullOrWhiteSpace(cursor))
            {
                if (!Guid.TryParse(cursor, out var after)) return BadRequest(new { message = "Invalid page cursor." });
                query = query.Where(p => p.Id.CompareTo(after) > 0);
            }
            // A unique, stable order keeps pages consistent when listings are removed.
            var items = await query.OrderBy(p => p.Id).Take(pageSize + 1).Select(p => new {
                p.Id, p.OwnerId, p.Title, p.Description, p.Address, p.MonthlyRent, p.Bedrooms,
                p.Bathrooms, p.Sqft, p.PropertyType, p.Facilities, p.FeatureTags, p.Status,
                documents = p.Documents.Select(document => new { document.DocumentType, document.DocumentUrl }).ToList(),
                photos = p.Photos.OrderByDescending(photo => photo.IsPrimary).ThenBy(photo => photo.Id)
                    .Select(photo => new { photo.PhotoUrl, photo.IsPrimary }).ToList()
            }).ToListAsync();
            var hasMore = items.Count > pageSize;
            if (hasMore) items.RemoveAt(pageSize);
            return Ok(new { items, hasMore, nextCursor = hasMore ? items[^1].Id.ToString() : null });
        }

        [AllowAnonymous]
        [HttpGet("owner/{ownerId}")]
        public async Task<IActionResult> GetPropertiesByOwner(Guid ownerId)
        {
            var properties = await _propertyService.GetPropertiesByOwnerIdAsync(ownerId);
            return Ok(properties);
        }

        [HttpGet("check-duplicate")]
        public async Task<IActionResult> CheckDuplicate([FromQuery] string address, [FromQuery] Guid? excludePropertyId = null)
        {
            if (string.IsNullOrWhiteSpace(address))
                return BadRequest(new { message = "Address is required." });

            // Ignore casing and repeated whitespace, but preserve house/unit numbers.
            static string Normalize(string value) => System.Text.RegularExpressions.Regex
                .Replace(value.Trim(), @"\s+", " ").ToUpperInvariant();

            var query = _context.Properties.AsNoTracking();
            if (excludePropertyId.HasValue)
                query = query.Where(p => p.Id != excludePropertyId.Value);
            var candidates = await query.Select(p => new { p.Id, p.Address, p.Status }).ToListAsync();
            var normalizedAddress = Normalize(address);
            var duplicate = candidates.FirstOrDefault(p => Normalize(p.Address) == normalizedAddress);
            return Ok(new { exists = duplicate != null, propertyId = duplicate?.Id, status = duplicate?.Status.ToString() });
        }

        [AllowAnonymous]
        [HttpGet("{id}")]
        public async Task<IActionResult> GetProperty(string id)
        {
            if (Guid.TryParse(id, out var guidId))
            {
                var property = await _propertyService.GetPropertyByIdAsync(guidId);
                if (property != null) return Ok(property);
            }

            var allProps = await _propertyService.GetAllPropertiesAsync();
            var matched = allProps.FirstOrDefault(p => p.Id.ToString().Equals(id, StringComparison.OrdinalIgnoreCase));
            if (matched != null) return Ok(matched);

            return NotFound(new { message = $"Property with ID '{id}' not found." });
        }

        [HttpPost]
        [Authorize(Roles = "Owner,Admin,PropertyOwner,Administrator,SystemAdmin")]
        public async Task<IActionResult> CreateProperty([FromBody] CreatePropertyDto dto)
        {
            if (dto.PhotoUrls == null || dto.PhotoUrls.Any(url => !IsPhotoUrl(url)))
                return BadRequest(new { message = "Photo links must be valid HTTP or HTTPS URLs." });
            var property = new Property
            {
                OwnerId = dto.OwnerId,
                Title = dto.Title,
                Description = dto.Description,
                Address = dto.Address,
                MonthlyRent = dto.MonthlyRent,
                Bedrooms = dto.Bedrooms,
                Bathrooms = dto.Bathrooms,
                Facilities = dto.Facilities,
                Sqft = dto.Sqft,
                PropertyType = dto.PropertyType,
                FeatureTags = dto.FeatureTags,
                PhotoCount = dto.PhotoCount,
                Status = PropertyStatus.PendingVerification
            };

            foreach (var url in dto.PhotoUrls.Select(url => url.Trim()).Distinct())
                property.Photos.Add(new PropertyPhoto { PhotoUrl = url, IsPrimary = property.Photos.Count == 0 });
            property.PhotoCount = property.Photos.Count;
            var createdProperty = await _propertyService.CreatePropertyAsync(property);
            
            // Explicitly load the Owner so it's included in the response
            var propertyWithOwner = await _propertyService.GetPropertyByIdAsync(createdProperty.Id);
            
            return CreatedAtAction(nameof(GetProperties), new { id = createdProperty.Id }, propertyWithOwner);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Owner,Admin,PropertyOwner,Administrator,SystemAdmin")]
        public async Task<IActionResult> UpdateProperty(Guid id, [FromBody] UpdatePropertyDto dto)
        {
            if (dto.PhotoUrls == null || dto.PhotoUrls.Any(url => !IsPhotoUrl(url)))
                return BadRequest(new { message = "Photo links must be valid HTTP or HTTPS URLs." });
            var existingProperty = await _propertyService.GetPropertyByIdAsync(id);
            if (existingProperty == null) return NotFound();

            bool isAdmin = User.IsInRole("Admin") || User.IsInRole("Administrator") || User.IsInRole("SystemAdmin");

            // Map fields from DTO
            existingProperty.Title = dto.Title;
            existingProperty.Description = dto.Description;
            existingProperty.Address = dto.Address;
            existingProperty.MonthlyRent = dto.MonthlyRent;
            existingProperty.Bedrooms = dto.Bedrooms;
            existingProperty.Bathrooms = dto.Bathrooms;
            existingProperty.Facilities = dto.Facilities;
            existingProperty.Sqft = dto.Sqft;
            existingProperty.PropertyType = dto.PropertyType;
            existingProperty.FeatureTags = dto.FeatureTags;
            existingProperty.PhotoCount = dto.PhotoCount;
            
            if (isAdmin && dto.Status.HasValue)
            {
                existingProperty.Status = dto.Status.Value;
            }
            
            existingProperty.UpdatedAt = DateTime.UtcNow;

            foreach (var url in dto.PhotoUrls.Select(url => url.Trim()).Distinct())
            {
                if (existingProperty.Photos.Any(photo => photo.PhotoUrl == url)) continue;
                var photo = new PropertyPhoto { PropertyId = id, PhotoUrl = url, IsPrimary = existingProperty.Photos.Count == 0 };
                existingProperty.Photos.Add(photo);
                _context.PropertyPhotos.Add(photo);
            }
            existingProperty.PhotoCount = existingProperty.Photos.Count;
            await _propertyService.UpdatePropertyAsync(existingProperty);
            return NoContent();
        }

        private static bool IsPhotoUrl(string? url) => Uri.TryCreate(url?.Trim(), UriKind.Absolute, out var uri)
            && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);

        [HttpPost("{id}/proof")]
        [Authorize(Roles = "Owner,PropertyOwner,Admin,Administrator,SystemAdmin")]
        public async Task<IActionResult> UploadOwnershipProof(Guid id, [FromBody] OwnershipProofDto dto)
        {
            var property = await _context.Properties.FindAsync(id);
            if (property == null) return NotFound(new { message = "Property not found" });
            var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            var isAdmin = User.IsInRole("Admin") || User.IsInRole("Administrator") || User.IsInRole("SystemAdmin");
            if (!isAdmin && (!Guid.TryParse(userIdValue, out var ownerId) || ownerId != property.OwnerId)) return Forbid();

            if (string.IsNullOrWhiteSpace(dto?.DocumentUrl))
            {
                return BadRequest(new { message = "Document URL or photo is required for ownership proof." });
            }

            var documentType = string.IsNullOrWhiteSpace(dto.DocumentType) ? "OwnershipProof" : dto.DocumentType;
            DocumentReviewRequest? reviewRequest = null;
            if (dto.ReviewRequestId.HasValue)
            {
                reviewRequest = await _context.DocumentReviewRequests.FirstOrDefaultAsync(r =>
                    r.Id == dto.ReviewRequestId.Value && r.PropertyId == id && r.OwnerId == property.OwnerId);
                if (reviewRequest == null) return NotFound(new { message = "Document request not found." });
                if (reviewRequest.ResubmittedAt.HasValue) return Conflict(new { message = "This document request has already been answered." });
                if (reviewRequest.DocumentUrl == dto.DocumentUrl)
                    return BadRequest(new { message = "Upload a new document to replace the document flagged by the administrator." });
            }
            // A file upload may have already saved this document before /proof is called.
            var doc = await _context.PropertyDocuments.FirstOrDefaultAsync(d =>
                d.PropertyId == id && d.DocumentUrl == dto.DocumentUrl && d.DocumentType == documentType);
            if (doc == null)
            {
                doc = new PropertyDocument { PropertyId = id, DocumentType = documentType, DocumentUrl = dto.DocumentUrl };
                _context.PropertyDocuments.Add(doc);
            }
            if (reviewRequest != null)
            {
                reviewRequest.ReplacementDocumentUrl = doc.DocumentUrl;
                reviewRequest.ResubmittedAt = DateTime.UtcNow;
                reviewRequest.UpdatedAt = DateTime.UtcNow;
            }
            await _context.SaveChangesAsync();

            var recommendation = "Needs Review";
            var reasoning = "Proof saved. Automated verification could not be completed; administrator review is required.";
            var verificationCompleted = false;
            // Trigger Agentic Service
            try
            {
                using var httpClient = new System.Net.Http.HttpClient();
                var workflowKey = Environment.GetEnvironmentVariable("AGENT_WORKFLOW_KEY") ?? _configuration["AgentWorkflowKey"];
                    if (string.IsNullOrWhiteSpace(workflowKey)) throw new InvalidOperationException("AI service is not configured.");
                    httpClient.DefaultRequestHeaders.Add("X-Workflow-Key", workflowKey);
                    var agentUrl = _configuration["AgenticServiceUrl"] ?? "https://rentwise-ai-service.onrender.com";
                var aiUrl = $"{agentUrl}/workflow/verify-property";
                var payload = new { property_id = id.ToString(), document_url = doc.DocumentUrl };
                var content = new System.Net.Http.StringContent(System.Text.Json.JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");
                
                var response = await httpClient.PostAsync(aiUrl, content);
                if (response.IsSuccessStatusCode)
                {
                    var resultString = await response.Content.ReadAsStringAsync();
                    using var result = System.Text.Json.JsonDocument.Parse(resultString);
                    if (result.RootElement.TryGetProperty("report", out var reportElement) && 
                        reportElement.ValueKind == System.Text.Json.JsonValueKind.Object &&
                        reportElement.TryGetProperty("recommendation", out var recElement) &&
                        recElement.ValueKind == System.Text.Json.JsonValueKind.String &&
                        reportElement.TryGetProperty("reasoning", out var reasonElement) &&
                        reasonElement.ValueKind == System.Text.Json.JsonValueKind.String)
                    {
                        var proposedRecommendation = recElement.GetString();
                        if ((proposedRecommendation == "Approve-ready" || proposedRecommendation == "Needs Review" ||
                             proposedRecommendation == "Reject-recommended") && !string.IsNullOrWhiteSpace(reasonElement.GetString()))
                        {
                            recommendation = proposedRecommendation;
                            reasoning = reasonElement.GetString()!;
                            verificationCompleted = true;
                        }
                    }
                }
                else
                {
                    Console.WriteLine($"Agentic OCR Verification returned status code: {response.StatusCode}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Agentic OCR Verification failed: {ex.Message}");
            }

            // Recommendations needing review remain unpublished until an administrator decides.
            // Keep a pre-existing suspension when the agent cannot approve the new proof.
            var requiresAdminReview = reviewRequest != null || await _context.DocumentReviewRequests.AnyAsync(r => r.PropertyId == id && r.ResubmittedAt == null);
            property.Status = recommendation == "Approve-ready" && !requiresAdminReview ? PropertyStatus.Active
                : property.Status == PropertyStatus.Suspended ? PropertyStatus.Suspended : PropertyStatus.PendingVerification;
            property.UpdatedAt = DateTime.UtcNow;
            var report = new { recommendation, reasoning, propertyAddress = property.Address, documentUrl = doc.DocumentUrl };
            _context.VerificationRecords.Add(new VerificationRecord
            {
                PropertyId = id,
                IsApproved = recommendation == "Approve-ready",
                Comments = "[AI_PROPERTY_VERIFICATION]",
                AgentReport = System.Text.Json.JsonSerializer.Serialize(report)
            });
            await _context.SaveChangesAsync();

            return Ok(new { success = true, verificationCompleted,
                message = requiresAdminReview ? $"Proof saved. Awaiting administrator review. AI recommendation: {recommendation}. {reasoning}"
                    : recommendation == "Approve-ready" ? "Proof saved. Property verification passed."
                    : $"Proof saved. {recommendation}: {reasoning}",
                document = doc, report, status = property.Status.ToString() });
        }

        [HttpPost("{id}/listing-fee")]
        [Authorize(Roles = "Owner,PropertyOwner,Admin,Administrator,SystemAdmin")]
        public async Task<IActionResult> PayListingFee(Guid id, [FromBody] ListingFeePaymentDto dto)
        {
            var property = await _context.Properties.FindAsync(id);
            if (property == null) return NotFound(new { message = "Property not found" });

            decimal feeAmount = dto?.Amount ?? 0;
            if (feeAmount < 2500)
            {
                return BadRequest(new { message = "Listing verification fee must be at least Rs. 2,500." });
            }

            var paymentRef = string.IsNullOrWhiteSpace(dto?.PaymentReference) 
                ? $"FEE-{Guid.NewGuid().ToString().Substring(0, 8).ToUpper()}" 
                : dto.PaymentReference;

            var record = new VerificationRecord
            {
                PropertyId = id,
                IsApproved = false, // Stays pending until Admin reviews and approves
                Comments = $"[LISTING_FEE_PAID: LKR {feeAmount:N2} | Ref: {paymentRef} | Method: {dto.PaymentMethod ?? "Card"} | Date: {DateTime.UtcNow:o}]",
                AgentReport = $"Listing verification fee paid (LKR {feeAmount:N2}). Ready for Admin Approval."
            };

            _context.VerificationRecords.Add(record);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "Listing fee of Rs. 2,500 successfully paid. Your property is now under Admin Review.", paymentReference = paymentRef });
        }

        [HttpGet("{id}/verification-status")]
        public async Task<IActionResult> GetVerificationStatus(Guid id)
        {
            var property = await _context.Properties
                .Include(p => p.Documents)
                .Include(p => p.VerificationRecords)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (property == null) return NotFound();

            var docs = property.Documents.ToList();
            var verifications = property.VerificationRecords.OrderByDescending(v => v.CreatedAt).ToList();

            bool isProofUploaded = docs.Any(d => d.DocumentType.Contains("Proof", StringComparison.OrdinalIgnoreCase) || d.DocumentType.Contains("Deed", StringComparison.OrdinalIgnoreCase) || d.DocumentType.Equals("UtilityBill", StringComparison.OrdinalIgnoreCase));
            bool isFeePaid = verifications.Any(v => v.Comments.Contains("[LISTING_FEE_PAID", StringComparison.OrdinalIgnoreCase) || v.AgentReport.Contains("fee paid", StringComparison.OrdinalIgnoreCase));
            bool isApproved = property.Status == PropertyStatus.Active;

            return Ok(new
            {
                propertyId = id,
                status = property.Status.ToString(),
                isApproved,
                isProofUploaded,
                isFeePaid,
                documents = docs,
                verifications
            });
        }

        [HttpPut("{id}/approve")]
        [Authorize(Roles = "Admin,Administrator,SystemAdmin")]
        public async Task<IActionResult> ApprovePropertyListing(Guid id, [FromBody] AdminApprovalDto? dto)
        {
            var property = await _context.Properties.FindAsync(id);
            if (property == null) return NotFound(new { message = "Property not found" });

            property.Status = PropertyStatus.Active;
            property.UpdatedAt = DateTime.UtcNow;

            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
                         ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                         ?? User.FindFirst("sub")?.Value;
            Guid.TryParse(userIdStr, out var adminId);

            var verification = new VerificationRecord
            {
                PropertyId = id,
                AdminId = adminId != Guid.Empty ? adminId : null,
                IsApproved = true,
                Comments = string.IsNullOrWhiteSpace(dto?.Comments) ? "Ownership proof and listing fee verified and approved." : dto.Comments,
                AgentReport = $"Approved by Admin on {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss UTC}"
            };

            _context.VerificationRecords.Add(verification);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "Property listing approved and published successfully!", status = "Active" });
        }

        [HttpPut("{id}/reject")]
        [Authorize(Roles = "Admin,Administrator,SystemAdmin")]
        public async Task<IActionResult> RejectPropertyListing(Guid id, [FromBody] AdminApprovalDto? dto)
        {
            var property = await _context.Properties.FindAsync(id);
            if (property == null) return NotFound(new { message = "Property not found" });

            property.Status = PropertyStatus.Suspended;
            property.UpdatedAt = DateTime.UtcNow;

            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
                         ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                         ?? User.FindFirst("sub")?.Value;
            Guid.TryParse(userIdStr, out var adminId);

            var reason = string.IsNullOrWhiteSpace(dto?.Comments) ? "Proof of ownership or fee verification rejected." : dto.Comments;

            var verification = new VerificationRecord
            {
                PropertyId = id,
                AdminId = adminId != Guid.Empty ? adminId : null,
                IsApproved = false,
                Comments = $"[REJECTED: {reason}]",
                AgentReport = $"Rejected by Admin: {reason}"
            };

            _context.VerificationRecords.Add(verification);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "Property listing rejected.", status = "Suspended", comments = reason });
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Owner,Admin,PropertyOwner,Administrator,SystemAdmin")]
        public async Task<IActionResult> DeleteProperty(Guid id)
        {
            await _propertyService.DeletePropertyAsync(id);
            return NoContent();
        }

        [HttpPut("{id}/status")]
        [Authorize(Roles = "Admin,Administrator,SystemAdmin")]
        public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdatePropertyStatusDto dto)
        {
            var result = await _propertyService.UpdatePropertyStatusAsync(id, dto.Status);
            if (!result) return NotFound();

            return Ok(new { message = "Status updated successfully", newStatus = dto.Status.ToString() });
        }

        [HttpGet("market-rent")]
        [AllowAnonymous]
        public async Task<IActionResult> GetMarketRent([FromQuery] string location = "", [FromQuery] string propertyType = "", [FromQuery] int bedrooms = 0)
        {
            var result = await _propertyService.GetMarketRentAsync(location, propertyType, bedrooms);
            return Ok(result);
        }
    }

    public class OwnershipProofDto
    {
        public Guid? ReviewRequestId { get; set; }
        public string DocumentType { get; set; } = "OwnershipProof";
        public string DocumentUrl { get; set; } = string.Empty;
    }

    public class ListingFeePaymentDto
    {
        public decimal Amount { get; set; } = 2500;
        public string PaymentMethod { get; set; } = "Card";
        public string PaymentReference { get; set; } = string.Empty;
    }

    public class AdminApprovalDto
    {
        public string Comments { get; set; } = string.Empty;
    }
}
