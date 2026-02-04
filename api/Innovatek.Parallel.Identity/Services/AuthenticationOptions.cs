namespace Innovatek.Parallel.Identity.Services;

public class AuthenticationOptions
{
    public const string SectionName = "Authentication";
    
    public bool Enabled { get; set; } = true;
    public string JwtSecret { get; set; } = string.Empty;
    public string JwtIssuer { get; set; } = "MiniCluster";
    public string JwtAudience { get; set; } = "MiniCluster";
    public int AccessTokenExpiryMinutes { get; set; } = 30;
    public int RefreshTokenExpiryDays { get; set; } = 7;
    public bool AllowAnonymousInDevelopment { get; set; } = false;
}
