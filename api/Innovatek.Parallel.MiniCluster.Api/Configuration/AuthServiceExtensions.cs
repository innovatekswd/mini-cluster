using Innovatek.Parallel.Identity.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Innovatek.Parallel.MiniCluster.Api.Data;

namespace Innovatek.Parallel.MiniCluster.Api.Configuration;

public static class AuthServiceExtensions
{
    public static IServiceCollection AddAuth(this IServiceCollection services, IConfiguration configuration)
    {
        // Authentication configuration
        services.AddOptions<AuthenticationOptions>()
            .BindConfiguration(AuthenticationOptions.SectionName)
            .ValidateDataAnnotations()
            .ValidateOnStart();

        var authConfig = configuration.GetSection(AuthenticationOptions.SectionName).Get<AuthenticationOptions>() 
            ?? new AuthenticationOptions();

        // JWT Authentication
        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = !string.IsNullOrEmpty(authConfig.JwtSecret),
                ValidIssuer = authConfig.JwtIssuer,
                ValidAudience = authConfig.JwtAudience,
                IssuerSigningKey = string.IsNullOrEmpty(authConfig.JwtSecret)
                    ? null
                    : new SymmetricSecurityKey(Encoding.UTF8.GetBytes(authConfig.JwtSecret)),
                ClockSkew = TimeSpan.Zero
            };

            // Support JWT in query string for SignalR
            options.Events = new JwtBearerEvents
            {
                OnMessageReceived = context =>
                {
                    var accessToken = context.Request.Query["access_token"];
                    var path = context.HttpContext.Request.Path;
                    
                    if (!string.IsNullOrEmpty(accessToken) && 
                        (path.StartsWithSegments("/loghub") || path.StartsWithSegments("/terminalhub")))
                    {
                        context.Token = accessToken;
                    }
                    return Task.CompletedTask;
                }
            };
        });

        services.AddAuthorization(options =>
        {
            AuthPolicies.ConfigurePolicies(options);
        });

        // Identity services
        services.AddScoped<IIdentityDbContext>(sp => sp.GetRequiredService<AppDbContext>());
        services.AddScoped<IAuthService, AuthService>();

        return services;
    }
}
