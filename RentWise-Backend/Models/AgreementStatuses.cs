namespace RentWise_Backend.Models;

public static class AgreementStatuses
{
    public const string Drafted = "Drafted";
    public const string PendingOwnerApproval = "PendingOwnerApproval";
    public const string Active = "Active";
    public const string Rejected = "Rejected";
    public const string RevisionRequested = "RevisionRequested";
    public const string Ended = "Ended";

    public static bool CanTransition(string current, string next) => (current, next) switch
    {
        (Drafted, PendingOwnerApproval) => true,
        (PendingOwnerApproval, Active or Rejected or RevisionRequested) => true,
        (RevisionRequested, Drafted) => true,
        (Active, Ended) => true,
        _ => false
    };
}
