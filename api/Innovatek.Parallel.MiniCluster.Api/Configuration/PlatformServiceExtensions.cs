using Innovatek.Parallel.MiniCluster.Api.Services;
using Innovatek.Parallel.TemplateEngine;
using Yarp.ReverseProxy.Configuration;

namespace Innovatek.Parallel.MiniCluster.Api.Configuration;

public static class PlatformServiceExtensions
{
    public static IServiceCollection AddPlatformServices(this IServiceCollection services, IConfiguration configuration)
    {
        // Identifier resolver for name-based lookups
        services.AddScoped<IIdentifierResolver, IdentifierResolver>();

        // Configuration validation
        services.AddOptions<LogCleanupOptions>()
            .BindConfiguration(LogCleanupOptions.SectionName)
            .ValidateDataAnnotations()
            .ValidateOnStart();

        // Machine service (cluster nodes)
        services.AddScoped<IMachineService, MachineService>();

        // Cluster services
        services.AddScoped<IClusterNotificationService, ClusterNotificationService>();
        services.AddOptions<AgentOptions>()
            .BindConfiguration(AgentOptions.SectionName)
            .ValidateDataAnnotations();
        services.AddHostedService<HeartbeatMonitorService>();
        services.AddHostedService<AgentRegistrationService>();

        // File Explorer
        services.Configure<ExplorerOptions>(configuration.GetSection(ExplorerOptions.SectionName));
        services.AddScoped<ExplorerService>();
        services.AddScoped<ArchiveService>();

        // Cron Scheduling
        services.AddScoped<ICronSchedulingService, CronSchedulingService>();
        services.AddHostedService<CronSchedulerBackgroundService>();

        // Service Versioning & Deployment
        services.AddScoped<IServiceVersioningService, ServiceVersioningService>();

        // Hierarchical Apps
        services.AddScoped<IAppTreeService, AppTreeService>();

        // Variable resolution services
        services.AddScoped<IEnvironmentService, EnvironmentService>();
        services.AddScoped<IVariableResolver, EnvironmentResolver>();
        services.AddScoped<IVariableResolverFactory, DefaultVariableResolverFactory>();

        // Reverse Proxy (YARP)
        services.AddSingleton<DatabaseProxyConfigProvider>();
        services.AddSingleton<IProxyConfigProvider>(sp => sp.GetRequiredService<DatabaseProxyConfigProvider>());
        services.AddSingleton<IProxyConfigNotifier>(sp => sp.GetRequiredService<DatabaseProxyConfigProvider>());
        services.AddReverseProxy();

        return services;
    }
}
