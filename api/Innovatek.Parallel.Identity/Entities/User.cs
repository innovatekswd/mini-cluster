namespace Innovatek.Parallel.Identity.Entities;

/// <summary>
/// User entity for authentication
/// </summary>
public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Username { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string PasswordHash { get; set; } = string.Empty;
    
    /// <summary>
    /// User role: Admin, Operator, Viewer
    /// - Admin: Full access, can manage users and all settings
    /// - Operator: Can manage apps, start/stop services, view logs
    /// - Viewer: Read-only access, can only view services and logs
    /// </summary>
    public string Role { get; set; } = "Operator";
    
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }
    
    // Navigation property
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}
