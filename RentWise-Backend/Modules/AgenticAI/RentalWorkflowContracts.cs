using System.ComponentModel.DataAnnotations;
using System.Text.Json;

namespace RentWise.API.Modules.AgenticAI;

public class StartRentalWorkflow
{
    [Required, StringLength(2000, MinimumLength = 10)]
    public string Objective { get; set; } = "";
    [Range(1, 10000000)] public decimal MaxMonthlyRent { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
}

public class WorkflowDecision
{
    [Required, RegularExpression("^(approve|reject|revise)$")]
    public string Decision { get; set; } = "";
    [StringLength(2000)] public string Note { get; set; } = "";
    public int Version { get; set; }
}

public class RentalWorkflowState
{
    public StartRentalWorkflow Request { get; set; } = new();
    public string[] Plan { get; set; } = RentalWorkflowRules.Plan;
    public Dictionary<string, JsonElement> Outputs { get; set; } = new();
    public string? Error { get; set; }
    public string ApprovalStatus { get; set; } = "NotRequested";
    public List<object> Decisions { get; set; } = new();
    public int Attempts { get; set; }
}

public static class RentalWorkflowRules
{
    public static readonly string[] Plan = ["MatchingLocation", "PropertyVerification", "AgreementPricing", "MaintenanceTriage"];
    public static readonly Dictionary<string, string> Tools = new()
    {
        ["MatchingLocation"] = "search_available_properties",
        ["PropertyVerification"] = "check_selected_property",
        ["AgreementPricing"] = "read_verified_terms",
        ["MaintenanceTriage"] = "read_agreement_handover"
    };
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public static string Serialize<T>(T value) => JsonSerializer.Serialize(value, Json);
    public static RentalWorkflowState Read(string json) => JsonSerializer.Deserialize<RentalWorkflowState>(json, Json)
        ?? throw new InvalidOperationException("Workflow state is invalid.");
    public static void ValidateRequest(StartRentalWorkflow request)
    {
        if (string.IsNullOrWhiteSpace(request.Objective) || request.Objective.Trim().Length < 10 || request.Objective.Length > 2000
            || request.MaxMonthlyRent <= 0 || request.MaxMonthlyRent > 10000000
            || request.StartDate.Date < DateTime.UtcNow.Date || request.EndDate <= request.StartDate
            || request.EndDate > request.StartDate.AddYears(5))
            throw new InvalidOperationException("Enter an objective, a positive budget, and a future lease period of at most five years.");
    }
    public static string RequiredText(JsonElement data, string key, int max = 4000)
    {
        if (!data.TryGetProperty(key, out var value) || value.ValueKind != JsonValueKind.String
            || string.IsNullOrWhiteSpace(value.GetString()) || value.GetString()!.Length > max)
            throw new InvalidOperationException($"Invalid agent output: {key}.");
        return value.GetString()!;
    }
    public static void ValidateOutput(string role, JsonElement output, Guid? selectedId, decimal? rent)
    {
        if (output.ValueKind != JsonValueKind.Object) throw new InvalidOperationException("Agent output must be an object.");
        var allowed = new HashSet<string> { "propertyId", "summary" };
        if (role == "PropertyVerification") allowed.Add("eligible");
        if (role == "AgreementPricing") { allowed.Add("monthlyRent"); allowed.Add("terms"); }
        if (role == "MaintenanceTriage") allowed.Add("checklist");
        if (output.EnumerateObject().Any(p => !allowed.Contains(p.Name)))
            throw new InvalidOperationException("Agent output contains unsupported fields.");
        RequiredText(output, "summary");
        if (!Guid.TryParse(RequiredText(output, "propertyId", 36), out var propertyId)
            || (selectedId != null && propertyId != selectedId))
            throw new InvalidOperationException("Agent changed the selected property.");
        if (role == "PropertyVerification" && (!output.TryGetProperty("eligible", out var eligible) || eligible.ValueKind != JsonValueKind.True))
            throw new InvalidOperationException("Property verification did not pass.");
        if (role == "AgreementPricing")
        {
            if (!output.TryGetProperty("monthlyRent", out var amount) || !amount.TryGetDecimal(out var actual) || actual != rent)
                throw new InvalidOperationException("Agent rent differs from the verified listing.");
            RequiredText(output, "terms", 12000);
        }
        if (role == "MaintenanceTriage")
        {
            if (!output.TryGetProperty("checklist", out var list) || list.ValueKind != JsonValueKind.Array
                || list.GetArrayLength() < 1 || list.GetArrayLength() > 10
                || list.EnumerateArray().Any(v => v.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(v.GetString()) || v.GetString()!.Length > 500))
                throw new InvalidOperationException("Invalid maintenance handover checklist.");
        }
    }
}
