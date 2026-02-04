using Innovatek.Parallel.MiniCluster.Api.Data;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace Innovatek.Parallel.MiniCluster.Api.Services;

/// <summary>
/// Resolves human-friendly identifiers to GUIDs.
/// Supports: UUID | short-id (8+ hex chars) | name | app/service
/// </summary>
public interface IIdentifierResolver
{
    /// <summary>
    /// Resolve an app identifier to its GUID.
    /// </summary>
    Task<ResolveResult<Guid>> ResolveAppAsync(string identifier);
    
    /// <summary>
    /// Resolve a service identifier to its GUID.
    /// Supports formats: uuid, short-id, name, app/service
    /// </summary>
    Task<ResolveResult<Guid>> ResolveServiceAsync(string identifier);
    
    /// <summary>
    /// Get the short ID (first 8 chars) for a GUID.
    /// </summary>
    string GetShortId(Guid id);
}

/// <summary>
/// Result of identifier resolution
/// </summary>
public class ResolveResult<T>
{
    public bool Success { get; init; }
    public T? Value { get; init; }
    public string? Error { get; init; }
    public List<AmbiguousMatch>? AmbiguousMatches { get; init; }
    
    public static ResolveResult<T> Ok(T value) => new() { Success = true, Value = value };
    public static ResolveResult<T> NotFound(string identifier) => new() 
    { 
        Success = false, 
        Error = $"'{identifier}' not found" 
    };
    public static ResolveResult<T> Ambiguous(string identifier, List<AmbiguousMatch> matches) => new()
    {
        Success = false,
        Error = $"'{identifier}' is ambiguous. Did you mean one of these?",
        AmbiguousMatches = matches
    };
}

public class AmbiguousMatch
{
    public string Id { get; init; } = "";
    public string ShortId { get; init; } = "";
    public string Name { get; init; } = "";
    public string? AppName { get; init; }
    public string FullPath => AppName != null ? $"{AppName}/{Name}" : Name;
}

public class IdentifierResolver : IIdentifierResolver
{
    private readonly AppDbContext _db;
    private static readonly Regex GuidRegex = new(@"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex ShortIdRegex = new(@"^[0-9a-f]{8,}$", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public IdentifierResolver(AppDbContext db)
    {
        _db = db;
    }

    public string GetShortId(Guid id) => id.ToString("N")[..8];

    public async Task<ResolveResult<Guid>> ResolveAppAsync(string identifier)
    {
        if (string.IsNullOrWhiteSpace(identifier))
            return ResolveResult<Guid>.NotFound(identifier);

        identifier = identifier.Trim();

        // 1. Full UUID
        if (GuidRegex.IsMatch(identifier) && Guid.TryParse(identifier, out var guid))
        {
            var exists = await _db.Apps.AnyAsync(a => a.Id == guid);
            return exists ? ResolveResult<Guid>.Ok(guid) : ResolveResult<Guid>.NotFound(identifier);
        }

        // 2. Short ID (8+ hex chars) - prefix match
        if (ShortIdRegex.IsMatch(identifier))
        {
            var normalizedId = identifier.ToLowerInvariant();
            var apps = await _db.Apps
                .AsNoTracking()
                .ToListAsync();
            
            var matches = apps
                .Where(a => a.Id.ToString("N").StartsWith(normalizedId, StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (matches.Count == 1)
                return ResolveResult<Guid>.Ok(matches[0].Id);
            
            if (matches.Count > 1)
            {
                var ambiguous = matches.Select(a => new AmbiguousMatch
                {
                    Id = a.Id.ToString(),
                    ShortId = GetShortId(a.Id),
                    Name = a.Name
                }).ToList();
                return ResolveResult<Guid>.Ambiguous(identifier, ambiguous);
            }
        }

        // 3. Name match (exact, case-insensitive)
        var byName = await _db.Apps
            .AsNoTracking()
            .Where(a => a.Name.ToLower() == identifier.ToLower())
            .ToListAsync();

        if (byName.Count == 1)
            return ResolveResult<Guid>.Ok(byName[0].Id);

        // 4. Partial name match
        var partialMatches = await _db.Apps
            .AsNoTracking()
            .Where(a => a.Name.ToLower().Contains(identifier.ToLower()))
            .ToListAsync();

        if (partialMatches.Count == 1)
            return ResolveResult<Guid>.Ok(partialMatches[0].Id);

        if (partialMatches.Count > 1)
        {
            var ambiguous = partialMatches.Select(a => new AmbiguousMatch
            {
                Id = a.Id.ToString(),
                ShortId = GetShortId(a.Id),
                Name = a.Name
            }).ToList();
            return ResolveResult<Guid>.Ambiguous(identifier, ambiguous);
        }

        return ResolveResult<Guid>.NotFound(identifier);
    }

    public async Task<ResolveResult<Guid>> ResolveServiceAsync(string identifier)
    {
        if (string.IsNullOrWhiteSpace(identifier))
            return ResolveResult<Guid>.NotFound(identifier);

        identifier = identifier.Trim();

        // 1. Full UUID
        if (GuidRegex.IsMatch(identifier) && Guid.TryParse(identifier, out var guid))
        {
            var exists = await _db.Services.AnyAsync(s => s.Id == guid);
            return exists ? ResolveResult<Guid>.Ok(guid) : ResolveResult<Guid>.NotFound(identifier);
        }

        // 2. Check for app/service format
        if (identifier.Contains('/'))
        {
            var parts = identifier.Split('/', 2);
            var appIdentifier = parts[0];
            var serviceIdentifier = parts[1];

            // Resolve app first
            var appResult = await ResolveAppAsync(appIdentifier);
            if (!appResult.Success)
            {
                return ResolveResult<Guid>.NotFound($"App '{appIdentifier}' not found");
            }

            // Find service by name within that app
            var services = await _db.Services
                .AsNoTracking()
                .Where(s => s.AppId == appResult.Value)
                .ToListAsync();

            var exactMatch = services.FirstOrDefault(s => 
                s.Name.Equals(serviceIdentifier, StringComparison.OrdinalIgnoreCase));
            
            if (exactMatch != null)
                return ResolveResult<Guid>.Ok(exactMatch.Id);

            var partialMatches = services
                .Where(s => s.Name.Contains(serviceIdentifier, StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (partialMatches.Count == 1)
                return ResolveResult<Guid>.Ok(partialMatches[0].Id);

            if (partialMatches.Count > 1)
            {
                var app = await _db.Apps.FindAsync(appResult.Value);
                var ambiguous = partialMatches.Select(s => new AmbiguousMatch
                {
                    Id = s.Id.ToString(),
                    ShortId = GetShortId(s.Id),
                    Name = s.Name,
                    AppName = app?.Name
                }).ToList();
                return ResolveResult<Guid>.Ambiguous(identifier, ambiguous);
            }

            return ResolveResult<Guid>.NotFound($"Service '{serviceIdentifier}' not found in app '{appIdentifier}'");
        }

        // 3. Short ID (8+ hex chars) - prefix match
        if (ShortIdRegex.IsMatch(identifier))
        {
            var normalizedId = identifier.ToLowerInvariant();
            var services = await _db.Services
                .AsNoTracking()
                .Include(s => s.App)
                .ToListAsync();
            
            var matches = services
                .Where(s => s.Id.ToString("N").StartsWith(normalizedId, StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (matches.Count == 1)
                return ResolveResult<Guid>.Ok(matches[0].Id);
            
            if (matches.Count > 1)
            {
                var ambiguous = matches.Select(s => new AmbiguousMatch
                {
                    Id = s.Id.ToString(),
                    ShortId = GetShortId(s.Id),
                    Name = s.Name,
                    AppName = s.App?.Name
                }).ToList();
                return ResolveResult<Guid>.Ambiguous(identifier, ambiguous);
            }
        }

        // 4. Name match (exact, case-insensitive)
        var byName = await _db.Services
            .AsNoTracking()
            .Include(s => s.App)
            .Where(s => s.Name.ToLower() == identifier.ToLower())
            .ToListAsync();

        if (byName.Count == 1)
            return ResolveResult<Guid>.Ok(byName[0].Id);

        if (byName.Count > 1)
        {
            var ambiguous = byName.Select(s => new AmbiguousMatch
            {
                Id = s.Id.ToString(),
                ShortId = GetShortId(s.Id),
                Name = s.Name,
                AppName = s.App?.Name
            }).ToList();
            return ResolveResult<Guid>.Ambiguous(identifier, ambiguous);
        }

        // 5. Partial name match
        var partialNameMatches = await _db.Services
            .AsNoTracking()
            .Include(s => s.App)
            .Where(s => s.Name.ToLower().Contains(identifier.ToLower()))
            .ToListAsync();

        if (partialNameMatches.Count == 1)
            return ResolveResult<Guid>.Ok(partialNameMatches[0].Id);

        if (partialNameMatches.Count > 1)
        {
            var ambiguous = partialNameMatches.Select(s => new AmbiguousMatch
            {
                Id = s.Id.ToString(),
                ShortId = GetShortId(s.Id),
                Name = s.Name,
                AppName = s.App?.Name
            }).ToList();
            return ResolveResult<Guid>.Ambiguous(identifier, ambiguous);
        }

        return ResolveResult<Guid>.NotFound(identifier);
    }
}
