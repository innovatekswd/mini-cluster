namespace Innovatek.Parallel.MiniCluster.Api.Services;

public class ProcessMonitoringService : BackgroundService
{
    private readonly ILogger<ProcessMonitoringService> _logger;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly TimeSpan _checkInterval = TimeSpan.FromSeconds(30);

    public ProcessMonitoringService(
        ILogger<ProcessMonitoringService> logger,
        IServiceScopeFactory scopeFactory)
    {
        _logger = logger;
        _scopeFactory = scopeFactory;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Process monitoring service started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(_checkInterval, stoppingToken);
                CheckApplicationHealth(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in process monitoring service");
            }
        }

        _logger.LogInformation("Process monitoring service stopped");
    }

    private void CheckApplicationHealth(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<ProcessMonitoringService>>();
        
        // Add health check logic here
        // For example: check for zombie processes, memory usage, etc.
        logger.LogDebug("Health check completed");
    }
}
