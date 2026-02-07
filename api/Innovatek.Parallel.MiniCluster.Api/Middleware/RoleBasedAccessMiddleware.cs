namespace Innovatek.Parallel.MiniCluster.Api.Middleware;

/// <summary>
/// Enforces role-based access control based on HTTP method and path:
/// - Viewer: GET/HEAD only (read-only access)
/// - Operator: All methods except user management (/api/auth/users)
/// - Admin: Full access
/// 
/// Runs after authentication. Skips unauthenticated requests (those are handled by [Authorize]).
/// Skips non-API paths (static files, SignalR, proxy).
/// </summary>
public class RoleBasedAccessMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RoleBasedAccessMiddleware> _logger;

    public RoleBasedAccessMiddleware(RequestDelegate next, ILogger<RoleBasedAccessMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? string.Empty;
        var method = context.Request.Method;

        // Only enforce on /api/* paths
        if (!path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        // Skip if not authenticated (let [Authorize] handle that)
        if (context.User.Identity?.IsAuthenticated != true)
        {
            await _next(context);
            return;
        }

        // Skip auth endpoints that are [AllowAnonymous] (login, refresh)
        if (path.StartsWith("/api/auth/login", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/api/auth/refresh", StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        var isReadOnly = method.Equals("GET", StringComparison.OrdinalIgnoreCase) ||
                         method.Equals("HEAD", StringComparison.OrdinalIgnoreCase) ||
                         method.Equals("OPTIONS", StringComparison.OrdinalIgnoreCase);

        var isAdmin = context.User.IsInRole("Admin");
        var isOperator = context.User.IsInRole("Operator");
        var isViewer = context.User.IsInRole("Viewer");

        // Admin: full access
        if (isAdmin)
        {
            await _next(context);
            return;
        }

        // Operator: everything except user management
        if (isOperator)
        {
            if (path.StartsWith("/api/auth/users", StringComparison.OrdinalIgnoreCase) && !isReadOnly)
            {
                _logger.LogInformation("Operator '{User}' denied access to user management: {Method} {Path}",
                    context.User.Identity?.Name, method, path);
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { error = "User management requires Admin role" });
                return;
            }

            // Allow settings read but deny write
            if (path.StartsWith("/api/settings", StringComparison.OrdinalIgnoreCase) && !isReadOnly)
            {
                _logger.LogInformation("Operator '{User}' denied access to settings management: {Method} {Path}",
                    context.User.Identity?.Name, method, path);
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { error = "Settings management requires Admin role" });
                return;
            }

            await _next(context);
            return;
        }

        // Viewer: read-only
        if (isViewer)
        {
            if (!isReadOnly)
            {
                _logger.LogInformation("Viewer '{User}' denied write access: {Method} {Path}",
                    context.User.Identity?.Name, method, path);
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { error = "Viewer role has read-only access" });
                return;
            }

            await _next(context);
            return;
        }

        // Unknown role — deny
        _logger.LogWarning("User '{User}' has no recognized role, denying access: {Method} {Path}",
            context.User.Identity?.Name, method, path);
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        await context.Response.WriteAsJsonAsync(new { error = "Insufficient permissions" });
    }
}

public static class RoleBasedAccessMiddlewareExtensions
{
    public static IApplicationBuilder UseRoleBasedAccess(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<RoleBasedAccessMiddleware>();
    }
}
