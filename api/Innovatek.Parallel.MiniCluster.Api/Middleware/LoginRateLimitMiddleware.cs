using System.Collections.Concurrent;

namespace Innovatek.Parallel.MiniCluster.Api.Middleware;

/// <summary>
/// Rate limiter for login attempts. Limits to 5 attempts per minute per IP address.
/// Uses a sliding window with automatic cleanup.
/// </summary>
public class LoginRateLimitMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<LoginRateLimitMiddleware> _logger;
    private static readonly ConcurrentDictionary<string, List<DateTime>> _attempts = new();
    private static readonly TimeSpan _window = TimeSpan.FromMinutes(1);
    private const int _maxAttempts = 5;
    private static DateTime _lastCleanup = DateTime.UtcNow;

    public LoginRateLimitMiddleware(RequestDelegate next, ILogger<LoginRateLimitMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? string.Empty;

        // Only apply to login endpoint
        if (!path.Equals("/api/auth/login", StringComparison.OrdinalIgnoreCase) ||
            !context.Request.Method.Equals("POST", StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        var clientIp = GetClientIp(context);
        var now = DateTime.UtcNow;

        // Periodic cleanup of stale entries (every 5 minutes)
        if ((now - _lastCleanup).TotalMinutes > 5)
        {
            CleanupStaleEntries(now);
            _lastCleanup = now;
        }

        var attempts = _attempts.GetOrAdd(clientIp, _ => new List<DateTime>());

        lock (attempts)
        {
            // Remove attempts outside the window
            attempts.RemoveAll(a => (now - a) > _window);

            if (attempts.Count >= _maxAttempts)
            {
                var oldestInWindow = attempts.Min();
                var retryAfter = (int)(_window - (now - oldestInWindow)).TotalSeconds + 1;

                _logger.LogWarning("Login rate limit exceeded for IP {ClientIp}: {Count} attempts in {Window}s",
                    clientIp, attempts.Count, _window.TotalSeconds);

                context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                context.Response.Headers["Retry-After"] = retryAfter.ToString();
                context.Response.ContentType = "application/json";
                context.Response.WriteAsJsonAsync(new
                {
                    error = "Too many login attempts. Please try again later.",
                    retryAfterSeconds = retryAfter
                }).Wait();
                return;
            }

            attempts.Add(now);
        }

        await _next(context);
    }

    private static string GetClientIp(HttpContext context)
    {
        // Check for forwarded-for header (behind reverse proxy)
        var forwarded = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrEmpty(forwarded))
        {
            // Take the first IP (client IP)
            return forwarded.Split(',', StringSplitOptions.TrimEntries).First();
        }

        return context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }

    private static void CleanupStaleEntries(DateTime now)
    {
        foreach (var key in _attempts.Keys.ToList())
        {
            if (_attempts.TryGetValue(key, out var attempts))
            {
                lock (attempts)
                {
                    attempts.RemoveAll(a => (now - a) > _window);
                    if (attempts.Count == 0)
                    {
                        _attempts.TryRemove(key, out _);
                    }
                }
            }
        }
    }
}

public static class LoginRateLimitMiddlewareExtensions
{
    public static IApplicationBuilder UseLoginRateLimit(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<LoginRateLimitMiddleware>();
    }
}
