using Microsoft.EntityFrameworkCore;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Core.Entities;

namespace Innovatek.Parallel.MiniCluster.Api.Middleware;

/// <summary>
/// Middleware to handle authentication for proxy routes.
/// Checks if the route requires authentication and validates the request.
/// </summary>
public class ProxyAuthMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ProxyAuthMiddleware> _logger;

    public ProxyAuthMiddleware(RequestDelegate next, ILogger<ProxyAuthMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, AppDbContext dbContext)
    {
        // Check if this is a proxy request by looking for proxy route metadata
        var endpoint = context.GetEndpoint();
        
        // If no endpoint or not a proxy route, continue
        if (endpoint == null)
        {
            await _next(context);
            return;
        }

        // Check for YARP route metadata
        var routeId = endpoint.Metadata.GetMetadata<Yarp.ReverseProxy.Model.RouteModel>()?.Config?.RouteId;
        
        if (string.IsNullOrEmpty(routeId))
        {
            await _next(context);
            return;
        }

        // Parse the route ID to get the proxy route ID
        // Route IDs are formatted as "proxy-{id}" or "proxy-subdomain-{id}"
        int? proxyRouteId = ParseProxyRouteId(routeId);
        
        if (!proxyRouteId.HasValue)
        {
            await _next(context);
            return;
        }

        // Get the proxy route from the database
        var proxyRoute = await dbContext.ProxyRoutes
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == proxyRouteId.Value);

        if (proxyRoute == null)
        {
            _logger.LogWarning("Proxy route {RouteId} not found in database", proxyRouteId.Value);
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            await context.Response.WriteAsJsonAsync(new { error = "Proxy route not found" });
            return;
        }

        // Check if route is enabled
        if (!proxyRoute.IsEnabled)
        {
            _logger.LogInformation("Proxy route {Name} is disabled", proxyRoute.Name);
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            await context.Response.WriteAsJsonAsync(new { error = "Proxy route is disabled" });
            return;
        }

        // Check if authentication is required
        if (proxyRoute.RequireAuth)
        {
            var isAuthenticated = await ValidateAuthenticationAsync(context, proxyRoute);
            
            if (!isAuthenticated)
            {
                _logger.LogInformation("Unauthorized access attempt to proxy route {Name}", proxyRoute.Name);
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsJsonAsync(new { error = "Authentication required" });
                return;
            }

            // Check role-based access if roles are specified
            if (!string.IsNullOrEmpty(proxyRoute.AllowedRoles))
            {
                var hasRequiredRole = await ValidateRolesAsync(context, proxyRoute.AllowedRoles);
                
                if (!hasRequiredRole)
                {
                    _logger.LogInformation("Access denied to proxy route {Name} - insufficient permissions", proxyRoute.Name);
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    await context.Response.WriteAsJsonAsync(new { error = "Insufficient permissions" });
                    return;
                }
            }
        }

        await _next(context);
    }

    private static int? ParseProxyRouteId(string routeId)
    {
        // Handle formats: "proxy-{id}" or "proxy-subdomain-{id}"
        var parts = routeId.Split('-');
        
        if (parts.Length < 2 || parts[0] != "proxy")
            return null;

        // Try to parse the last part as an integer
        if (int.TryParse(parts[^1], out var id))
            return id;

        return null;
    }

    private Task<bool> ValidateAuthenticationAsync(HttpContext context, ProxyRoute proxyRoute)
    {
        // Check for API key in header or query string
        var apiKey = context.Request.Headers["X-Proxy-Key"].FirstOrDefault()
            ?? context.Request.Query["proxy_key"].FirstOrDefault();

        if (!string.IsNullOrEmpty(apiKey))
        {
            // Validate API key against the route's configured key
            // For now, we'll use a simple comparison
            // In production, this should use secure comparison and hashing
            if (!string.IsNullOrEmpty(proxyRoute.ApiKey) && apiKey == proxyRoute.ApiKey)
            {
                return Task.FromResult(true);
            }
        }

        // Check for session cookie (for browser-based access)
        var sessionCookie = context.Request.Cookies["proxy_session"];
        if (!string.IsNullOrEmpty(sessionCookie))
        {
            // TODO: Implement session validation
            // For now, just check if the cookie exists
            // In production, validate against a session store
            return Task.FromResult(true);
        }

        // Check for bearer token (JWT)
        var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
        if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            // TODO: Implement JWT validation
            // For now, just check if a token is present
            // In production, validate the JWT token
            return Task.FromResult(true);
        }

        return Task.FromResult(false);
    }

    private Task<bool> ValidateRolesAsync(HttpContext context, string allowedRoles)
    {
        // Parse allowed roles (comma-separated)
        var roles = allowedRoles.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        
        // TODO: Implement role validation against the authenticated user
        // For now, allow access if any authentication was provided
        // In production, extract roles from JWT claims or session and compare
        
        return Task.FromResult(true);
    }
}

/// <summary>
/// Extension methods for adding proxy authentication middleware
/// </summary>
public static class ProxyAuthMiddlewareExtensions
{
    public static IApplicationBuilder UseProxyAuth(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<ProxyAuthMiddleware>();
    }
}
