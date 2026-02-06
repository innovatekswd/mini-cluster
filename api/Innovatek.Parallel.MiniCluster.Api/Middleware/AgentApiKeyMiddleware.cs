using Microsoft.EntityFrameworkCore;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Helpers;
using Innovatek.Parallel.MiniCluster.Core.Entities;

namespace Innovatek.Parallel.MiniCluster.Api.Middleware;

/// <summary>
/// Middleware that validates API key authentication for /api/cluster/* endpoints.
/// Agent nodes include their API key via the X-Agent-Api-Key header.
/// The key is hashed and matched against Machine.AgentApiKey in the database.
/// </summary>
public class AgentApiKeyMiddleware
{
    private const string ApiKeyHeader = "X-Agent-Api-Key";
    private readonly RequestDelegate _next;
    private readonly ILogger<AgentApiKeyMiddleware> _logger;

    public AgentApiKeyMiddleware(RequestDelegate next, ILogger<AgentApiKeyMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, AppDbContext db)
    {
        // Only apply to /api/cluster/* endpoints
        if (!context.Request.Path.StartsWithSegments("/api/cluster"))
        {
            await _next(context);
            return;
        }

        // Allow cluster/status endpoint without API key (it's read-only, protected by JWT)
        if (context.Request.Path.StartsWithSegments("/api/cluster/status") ||
            context.Request.Path.StartsWithSegments("/api/cluster/nodes"))
        {
            await _next(context);
            return;
        }

        if (!context.Request.Headers.TryGetValue(ApiKeyHeader, out var apiKeyValues) ||
            string.IsNullOrWhiteSpace(apiKeyValues.FirstOrDefault()))
        {
            _logger.LogWarning(
                "Missing or empty {Header} header on {Method} {Path}",
                ApiKeyHeader, context.Request.Method, context.Request.Path);

            context.Response.StatusCode = 401;
            await context.Response.WriteAsJsonAsync(new
            {
                error = "Missing X-Agent-Api-Key header",
                detail = "Agent requests to /api/cluster/* must include a valid API key."
            });
            return;
        }

        var plainKey = apiKeyValues.First()!;
        var hashedKey = ConfigHasher.HashApiKey(plainKey);

        // Look up machine by hashed API key
        var machine = await db.Machines
            .FirstOrDefaultAsync(m => m.AgentApiKey == hashedKey);

        if (machine == null)
        {
            _logger.LogWarning(
                "Invalid API key on {Method} {Path} (hash: {Hash})",
                context.Request.Method, context.Request.Path,
                hashedKey[..12] + "...");

            context.Response.StatusCode = 403;
            await context.Response.WriteAsJsonAsync(new
            {
                error = "Invalid API key",
                detail = "The provided API key does not match any registered machine."
            });
            return;
        }

        // Store the authenticated machine in HttpContext for downstream handlers
        context.Items["AgentMachine"] = machine;
        context.Items["AgentMachineId"] = machine.Id;

        await _next(context);
    }
}

public static class AgentApiKeyMiddlewareExtensions
{
    public static IApplicationBuilder UseAgentApiKeyAuth(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<AgentApiKeyMiddleware>();
    }
}
