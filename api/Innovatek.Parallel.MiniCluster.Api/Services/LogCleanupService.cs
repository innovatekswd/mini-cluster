using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Configuration;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Innovatek.Parallel.MiniCluster.Api.Services;

public class LogCleanupService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<LogCleanupService> _logger;
    private readonly LogCleanupOptions _options;
    private readonly TimeSpan _cleanupInterval;
    private readonly TimeSpan _defaultRetentionPeriod;

    public LogCleanupService(
        IServiceScopeFactory scopeFactory,
        ILogger<LogCleanupService> logger,
        IOptions<LogCleanupOptions> options)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _options = options.Value;
        
        _cleanupInterval = TimeSpan.FromMinutes(_options.IntervalMinutes);
        _defaultRetentionPeriod = TimeSpan.FromHours(_options.RetentionHours);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "Log cleanup service started. Interval: {Interval}, Retention: {Retention}",
            _cleanupInterval, _defaultRetentionPeriod);

        // Wait 1 minute after startup before first cleanup
        await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PerformCleanupAsync(stoppingToken);
                await Task.Delay(_cleanupInterval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during log cleanup");
                await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken); // Wait before retry
            }
        }

        _logger.LogInformation("Log cleanup service stopped");
    }

    private async Task PerformCleanupAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var logsDb = scope.ServiceProvider.GetRequiredService<LogsDbContext>();
        var controlDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var cutoffTime = DateTime.UtcNow - _defaultRetentionPeriod;

        _logger.LogInformation("Starting log cleanup for entries older than {CutoffTime}", cutoffTime);

        // Get service-specific retention settings if needed
        var serviceRetentionSettings = await GetServiceRetentionSettingsAsync(controlDb, cancellationToken);

        // Delete old lifecycle events
        var deletedEvents = await logsDb.LifecycleEvents
            .Where(e => e.Timestamp < cutoffTime)
            .ExecuteDeleteAsync(cancellationToken);

        // Delete old session logs (in batches to avoid locks)
        var deletedLogs = 0;
        var batchSize = 5000;
        while (true)
        {
            var batch = await logsDb.SessionLogs
                .Where(l => l.Timestamp < cutoffTime)
                .Take(batchSize)
                .Select(l => l.Id)
                .ToListAsync(cancellationToken);

            if (batch.Count == 0) break;

            await logsDb.SessionLogs
                .Where(l => batch.Contains(l.Id))
                .ExecuteDeleteAsync(cancellationToken);

            deletedLogs += batch.Count;
            
            if (batch.Count < batchSize) break;
            
            // Brief pause between batches
            await Task.Delay(100, cancellationToken);
        }

        // Delete old sessions (after their logs are deleted)
        var deletedSessions = await logsDb.ServiceSessions
            .Where(s => s.EndTimestamp != null && s.EndTimestamp < cutoffTime)
            .ExecuteDeleteAsync(cancellationToken);

        _logger.LogInformation(
            "Cleanup completed. Deleted: {Logs} logs, {Events} events, {Sessions} sessions",
            deletedLogs, deletedEvents, deletedSessions);

        // Vacuum database to reclaim space (optional, can be expensive)
        if (_options.AutoVacuum)
        {
            await VacuumDatabaseAsync(logsDb, cancellationToken);
        }
    }

    private Task<Dictionary<Guid, TimeSpan>> GetServiceRetentionSettingsAsync(
        AppDbContext controlDb, 
        CancellationToken cancellationToken)
    {
        // Future enhancement: store retention period in Service entity
        // For now, return empty (use default for all services)
        return Task.FromResult(new Dictionary<Guid, TimeSpan>());
    }

    private async Task VacuumDatabaseAsync(LogsDbContext logsDb, CancellationToken cancellationToken)
    {
        try
        {
            _logger.LogInformation("Running VACUUM on logs database to reclaim space");
            await logsDb.Database.ExecuteSqlRawAsync("VACUUM", cancellationToken);
            _logger.LogInformation("VACUUM completed successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to VACUUM logs database");
        }
    }
}
