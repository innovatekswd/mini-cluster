using Innovatek.Parallel.Identity.Entities;
using Microsoft.EntityFrameworkCore;

namespace Innovatek.Parallel.Identity.Services;

/// <summary>
/// Interface for database context that provides identity entities.
/// Implement this interface in your application's DbContext.
/// </summary>
public interface IIdentityDbContext
{
    DbSet<User> Users { get; }
    DbSet<RefreshToken> RefreshTokens { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
