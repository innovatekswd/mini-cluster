using Innovatek.Parallel.MiniCluster.Api.Services;

namespace Innovatek.Parallel.MiniCluster.Api.Configuration;

public static class ProcessManagementExtensions
{
    public static IServiceCollection AddProcessManagement(this IServiceCollection services)
    {
        // Process management and logging
        services.AddSingleton<IServiceProcessManager, ServiceProcessManager>();
        services.AddSingleton<ILogBatchService, LogBatchService>();
        services.AddHostedService(provider => (LogBatchService)provider.GetRequiredService<ILogBatchService>());
        services.AddHostedService<ProcessMonitoringService>();
        services.AddHostedService<LogCleanupService>();

        // Health check & auto-restart
        services.AddSingleton<HealthCheckService>();
        services.AddSingleton<IHealthCheckService>(provider =>
            provider.GetRequiredService<HealthCheckService>());
        services.AddHostedService(provider =>
            provider.GetRequiredService<HealthCheckService>());

        services.AddSingleton<AutoRestartService>();
        services.AddSingleton<IAutoRestartService>(provider =>
            provider.GetRequiredService<AutoRestartService>());
        services.AddHostedService(provider =>
            provider.GetRequiredService<AutoRestartService>());

        // Process metrics collection
        services.AddSingleton<ProcessMetricsCollectionService>();
        services.AddSingleton<IProcessMetricsService>(provider => 
            provider.GetRequiredService<ProcessMetricsCollectionService>());
        services.AddHostedService(provider => 
            provider.GetRequiredService<ProcessMetricsCollectionService>());

        // Terminal service for PTY/REPL support
        services.AddSingleton<ITerminalService, TerminalService>();

        return services;
    }
}
