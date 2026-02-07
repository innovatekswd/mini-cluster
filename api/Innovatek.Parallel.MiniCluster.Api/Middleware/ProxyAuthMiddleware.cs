using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Innovatek.Parallel.Identity.Services;
using Microsoft.Extensions.Options;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Innovatek.Parallel.MiniCluster.Api.Middleware;

/// <summary>
/// Middleware to handle authentication for proxy routes.
/// Checks if the route requires authentication and validates the request.
/// Supports: API key header, JWT Bearer token, session cookie (JWT-based).
/// </summary>
public class ProxyAuthMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ProxyAuthMiddleware> _logger;
    private readonly TokenValidationParameters _tokenValidationParams;

    public ProxyAuthMiddleware(
        RequestDelegate next,
        ILogger<ProxyAuthMiddleware> logger,
        IOptions<AuthenticationOptions> authOptions)
    {
        _next = next;
        _logger = logger;

        var opts = authOptions.Value;
        _tokenValidationParams = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = opts.JwtIssuer,
            ValidAudience = opts.JwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(opts.JwtSecret)),
            ClockSkew = TimeSpan.Zero
        };
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
        // 1. Check for API key in header or query string
        var apiKey = context.Request.Headers["X-Proxy-Key"].FirstOrDefault()
            ?? context.Request.Query["proxy_key"].FirstOrDefault();

        if (!string.IsNullOrEmpty(apiKey))
        {
            if (!string.IsNullOrEmpty(proxyRoute.ApiKey) && apiKey == proxyRoute.ApiKey)
            {
                return Task.FromResult(true);
            }
        }

        // 2. Check for Bearer token (JWT)
        var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
        if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            var token = authHeader["Bearer ".Length..].Trim();
            var principal = ValidateJwtToken(token);
            if (principal != null)
            {
                context.User = principal;
                return Task.FromResult(true);
            }
        }

        // 3. Check for session cookie (contains JWT)
        var sessionCookie = context.Request.Cookies["proxy_session"];
        if (!string.IsNullOrEmpty(sessionCookie))
        {
            var principal = ValidateJwtToken(sessionCookie);
            if (principal != null)
            {
                context.User = principal;
                return Task.FromResult(true);
            }
        }

        // 4. Check if the request already has a valid identity from upstream auth middleware
        if (context.User.Identity?.IsAuthenticated == true)
        {
            return Task.FromResult(true);
        }

        return Task.FromResult(false);
    }

    private ClaimsPrincipal? ValidateJwtToken(string token)
    {
        try
        {
            var handler = new JwtSecurityTokenHandler();
            var principal = handler.ValidateToken(token, _tokenValidationParams, out _);
            return principal;
        }
        catch (SecurityTokenException ex)
        {
            _logger.LogDebug(ex, "JWT validation failed for proxy auth");
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Unexpected error validating JWT for proxy auth");
            return null;
        }
    }

    private Task<bool> ValidateRolesAsync(HttpContext context, string allowedRoles)
    {
        var roles = allowedRoles.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        // Check if the authenticated user has any of the required roles
        if (context.User.Identity?.IsAuthenticated == true)
        {
            foreach (var role in roles)
            {
                if (context.User.IsInRole(role))
                {
                    return Task.FromResult(true);
                }
            }

            _logger.LogDebug("User {User} does not have any of the required roles: {Roles}",
                context.User.Identity.Name, allowedRoles);
            return Task.FromResult(false);
        }

        // API key auth doesn't carry roles — if API key was valid and roles are required, deny
        return Task.FromResult(false);
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
