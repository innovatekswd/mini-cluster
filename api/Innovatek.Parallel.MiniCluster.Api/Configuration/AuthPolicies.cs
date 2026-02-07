using Microsoft.AspNetCore.Authorization;

namespace Innovatek.Parallel.MiniCluster.Api.Configuration;

/// <summary>
/// MiniCluster authorization policy names.
/// Role hierarchy: Admin > Operator > Viewer
/// - Admin: Full access, user management, settings
/// - Operator: Manage apps/services, start/stop, deploy, configure proxy
/// - Viewer: Read-only access, view services/logs/metrics
/// </summary>
public static class AuthPolicies
{
    /// <summary>Requires Admin role</summary>
    public const string AdminOnly = "AdminOnly";

    /// <summary>Requires Admin or Operator role (manage apps, start/stop services)</summary>
    public const string OperatorOrAbove = "OperatorOrAbove";

    /// <summary>Requires any authenticated role (view-only access)</summary>
    public const string ViewerOrAbove = "ViewerOrAbove";

    public static void ConfigurePolicies(AuthorizationOptions options)
    {
        options.AddPolicy(AdminOnly, policy =>
            policy.RequireRole("Admin"));

        options.AddPolicy(OperatorOrAbove, policy =>
            policy.RequireRole("Admin", "Operator"));

        options.AddPolicy(ViewerOrAbove, policy =>
            policy.RequireRole("Admin", "Operator", "Viewer"));
    }
}
