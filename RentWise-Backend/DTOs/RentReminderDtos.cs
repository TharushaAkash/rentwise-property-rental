using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace RentWise_Backend.DTOs;

public sealed class CreateRentReminderRequest
{
    public DateTime DueDate { get; init; }
}

[JsonConverter(typeof(JsonStringEnumConverter<RentReminderAction>))]
public enum RentReminderAction { MarkSent = 1, Complete = 2 }

public sealed class UpdateRentReminderRequest
{
    [EnumDataType(typeof(RentReminderAction))]
    public RentReminderAction Action { get; init; }
}

public sealed record RentReminderResponse(int Id, int RentalAgreementId, DateTime DueDate,
    DateTime? ReminderSentAt, string Status);
