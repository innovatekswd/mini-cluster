using Innovatek.Parallel.Identity.Services;
using Microsoft.Extensions.Options;
using System.Security.Claims;

namespace Innovatek.Parallel.MiniCluster.Api.Middleware;

/// <summary>
/// When Authentication.Enabled is false, this middleware sets a synthetic Admin identity
/// on every request so [Authorize] attributes pass without requiring login.
/// When AllowAnonymousInDevelopment is true and the environment is Development,
/// the same bypass applies.
/// </summary>
public class AuthenticationBypassMiddleware
{
    private readonly RequestDelegate _next;
    private readonly bool _bypass;

    public AuthenticationBypassMiddleware(
        RequestDelegate next,
        IOptions<AuthenticationOptions> authOptions,
        IWebHostEnvironment env)
    {
        _next = next;

        var opts = authOptions.Value;
        _bypass = !opts.Enabled || (opts.AllowAnonymousInDevelopment && env.IsDevelopment());
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (_bypass && !context.User.Identity?.IsAuthenticated == true)
        {
            // Set a synthetic admin identity so [Authorize] passes
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, Guid.Empty.ToString()),
                new Claim(ClaimTypes.Name, "anonymous"),
                new Claim(ClaimTypes.Role, "Admin"),
            };

            context.User = new ClaimsPrincipal(
                new ClaimsIdentity(claims, "Bypass"));
        }

        await _next(context);
    }
}

public static class AuthenticationBypassMiddlewareExtensions
{
    public static IApplicationBuilder UseAuthenticationBypass(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<AuthenticationBypassMiddleware>();
    }
}
