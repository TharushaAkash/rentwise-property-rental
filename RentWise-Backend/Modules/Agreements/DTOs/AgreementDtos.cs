using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace RentWise_Backend.DTOs;

public sealed class CreateAgreementDraftRequest
{
    public Guid ApplicationId { get; init; }
    public Guid PropertyId { get; init; }
    public Guid TenantId { get; init; }
    public Guid OwnerId { get; init; }
    [Range(typeof(decimal), "0.01", "9999999999.99")] public decimal MonthlyRent { get; init; }
    public DateTime StartDate { get; init; }
    public DateTime EndDate { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<AgreementDecision>))]
public enum AgreementDecision { Approve = 1, Reject = 2, RequestRevision = 3 }

public sealed class AgreementDecisionRequest
{
    [EnumDataType(typeof(AgreementDecision))]
    public AgreementDecision Decision { get; init; }
    [StringLength(1000)] public string? Reason { get; init; }
}

public sealed record AgreementResponse(Guid Id, Guid ApplicationId, Guid PropertyId,
    Guid TenantId, Guid OwnerId, decimal MonthlyRent, DateTime StartDate, DateTime EndDate,
    string Status, DateTime CreatedAt, DateTime UpdatedAt);
