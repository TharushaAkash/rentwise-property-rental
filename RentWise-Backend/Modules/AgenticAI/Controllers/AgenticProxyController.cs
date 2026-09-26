using Microsoft.AspNetCore.Mvc;
using System.Text;

namespace RentWise.API.Modules.AgenticAI.Controllers
{
    /// <summary>
    /// Proxy controller that forwards /api/agentic/** requests to the
    /// RentWise Python Agentic Service (hosted on Render).
    /// This allows the frontend (Cloudflare Pages) to call a single base URL
    /// (Azure backend) for both REST API and AI workflows, without CORS issues.
    /// </summary>
    [ApiController]
    [Route("api/agentic")]
    public class AgenticProxyController : ControllerBase
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;
        private readonly ILogger<AgenticProxyController> _logger;

        public AgenticProxyController(
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration,
            ILogger<AgenticProxyController> logger)
        {
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
            _logger = logger;
        }

        /// <summary>
        /// Forwards POST /api/agentic/{path} -> Python AI service /{path}
        /// e.g. POST /api/agentic/workflow/match-location
        ///      -> https://rentwise-ai-service.onrender.com/workflow/match-location
        /// </summary>
        [HttpPost("{**path}")]
        public async Task<IActionResult> ProxyPost(string path)
            => await ForwardRequest(HttpMethod.Post, path);

        /// <summary>
        /// Forwards GET /api/agentic/{path} -> Python AI service /{path}
        /// e.g. GET /api/agentic/health -> https://rentwise-ai-service.onrender.com/health
        /// </summary>
        [HttpGet("{**path}")]
        public async Task<IActionResult> ProxyGet(string path)
            => await ForwardRequest(HttpMethod.Get, path);

        private async Task<IActionResult> ForwardRequest(HttpMethod method, string path)
        {
            // Read AI service URL from env/config — defaults to Render deployment URL
            var agenticBaseUrl = Environment.GetEnvironmentVariable("AgenticServiceUrl")
                ?? _configuration["AgenticServiceUrl"]
                ?? "https://rentwise-ai-service.onrender.com";

            agenticBaseUrl = agenticBaseUrl.TrimEnd('/');
            var targetUrl = $"{agenticBaseUrl}/{path}";

            _logger.LogInformation("[AgenticProxy] {Method} {Target}", method, targetUrl);

            try
            {
                var client = _httpClientFactory.CreateClient("AgenticProxy");

                var requestMessage = new HttpRequestMessage(method, targetUrl);

                // Forward request body for POST requests
                if (method == HttpMethod.Post)
                {
                    Request.EnableBuffering();
                    var bodyBytes = await new StreamReader(Request.Body).ReadToEndAsync();
                    requestMessage.Content = new StringContent(bodyBytes, Encoding.UTF8, "application/json");
                }

                var response = await client.SendAsync(requestMessage);
                var responseBody = await response.Content.ReadAsStringAsync();

                _logger.LogInformation("[AgenticProxy] Response {StatusCode}", response.StatusCode);

                // Return raw JSON from Python service with same status code
                return Content(responseBody, "application/json", Encoding.UTF8);
            }
            catch (TaskCanceledException)
            {
                _logger.LogWarning("[AgenticProxy] Timeout reaching AI service: {Url}", targetUrl);
                return StatusCode(504, "{\"error\":\"AI service timed out. It may be cold-starting on Render. Please retry.\"}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[AgenticProxy] Failed to reach AI service: {Url}", targetUrl);
                return StatusCode(502, $"{{\"error\":\"Could not reach AI service.\",\"detail\":\"{ex.Message}\"}}");
            }
        }
    }
}
