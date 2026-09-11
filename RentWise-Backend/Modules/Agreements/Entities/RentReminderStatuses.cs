namespace RentWise_Backend.Models;

public static class RentReminderStatuses
{
    public const string Pending = "Pending";
    public const string Sent = "Sent";
    public const string Completed = "Completed";
    // A time-dependent view of any unfinished reminder past its due date.
    public const string Overdue = "Overdue";
}
