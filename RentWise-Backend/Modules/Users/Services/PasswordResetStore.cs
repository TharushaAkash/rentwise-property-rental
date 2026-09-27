using Microsoft.Extensions.Caching.Memory;

namespace RentWise.API.Modules.Users.Services;

// Short-lived secrets never enter logs or the database. Restarting the API invalidates them.
public sealed class PasswordResetStore : IDisposable
{
    private readonly MemoryCache _cache = new(new MemoryCacheOptions { SizeLimit = 10000 });
    private readonly SemaphoreSlim[] _locks = Enumerable.Range(0, 64).Select(_ => new SemaphoreSlim(1, 1)).ToArray();
    public SemaphoreSlim Gate(string email) => _locks[(uint)StringComparer.Ordinal.GetHashCode(email) % (uint)_locks.Length];
    public ResetChallenge? Get(string email) => _cache.Get<ResetChallenge>(email);
    public void Put(string email, ResetChallenge challenge) => _cache.Set(email, challenge,
        new MemoryCacheEntryOptions { Size = 1, AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(15) });
    public void Remove(string email) => _cache.Remove(email);
    public void Dispose()
    {
        _cache.Dispose();
        foreach (var gate in _locks) gate.Dispose();
    }
}

public sealed class ResetChallenge
{
    public Guid? UserId { get; init; }
    public string? PasswordHash { get; init; }
    public byte[] CodeHash { get; init; } = [];
    public DateTimeOffset ExpiresAt { get; set; }
    public int Attempts { get; set; }
    public byte[]? TokenHash { get; set; }
    public DateTimeOffset TokenExpiresAt { get; set; }
}
