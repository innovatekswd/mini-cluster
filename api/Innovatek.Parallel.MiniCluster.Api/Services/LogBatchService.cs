using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Helpers;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using System.Threading.Channels;

namespace Innovatek.Parallel.MiniCluster.Api.Services;

public interface ILogBatchService
{
    void QueueLog(SessionLogEntry logEntry);
}

public class LogBatchService : BackgroundService, ILogBatchService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<LogBatchService> _logger;
    private readonly Channel<SessionLogEntry> _logChannel;
    private readonly int _batchSize = 50;
    private readonly TimeSpan _batchInterval = TimeSpan.FromSeconds(2);

    public LogBatchService(
        IServiceScopeFactory scopeFactory,
        ILogger<LogBatchService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _logChannel = Channel.CreateUnbounded<SessionLogEntry>(new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = false
        });
    }

    public void QueueLog(SessionLogEntry logEntry)
    {
        if (!_logChannel.Writer.TryWrite(logEntry))
        {
            _logger.LogWarning("Failed to queue log entry - channel full");
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Log batch service started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var batch = new List<SessionLogEntry>();
                var deadline = DateTime.UtcNow.Add(_batchInterval);

                // Collect logs until batch size or timeout
                while (batch.Count < _batchSize && DateTime.UtcNow < deadline)
                {
                    try
                    {
                        var timeout = deadline - DateTime.UtcNow;
                        if (timeout <= TimeSpan.Zero) break;

                        if (await _logChannel.Reader.WaitToReadAsync(stoppingToken))
                        {
                            while (batch.Count < _batchSize && _logChannel.Reader.TryRead(out var log))
                            {
                                batch.Add(log);
                            }
                        }
                    }
                    catch (OperationCanceledException)
                    {
                        break;
                    }
                }

                // Save batch if we have logs
                if (batch.Count > 0)
                {
                    await SaveBatchAsync(batch, stoppingToken);
                }
                else
                {
                    // If no logs, wait a bit before checking again
                    try
                    {
                        await Task.Delay(100, stoppingToken);
                    }
                    catch (OperationCanceledException)
                    {
                        break;
                    }
                }
            }
            catch (OperationCanceledException)
            {
                // Expected during shutdown
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in log batch service");
                try
                {
                    await Task.Delay(1000, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }

        // Flush remaining logs on shutdown - use CancellationToken.None to allow completion
        await FlushRemainingLogsAsync();
        _logger.LogInformation("Log batch service stopped");
    }

    private async Task SaveBatchAsync(List<SessionLogEntry> batch, CancellationToken cancellationToken)
    {
        try
        {
            await DatabaseRetryHelper.ExecuteWithRetryAsync(async () =>
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<LogsDbContext>();

                db.SessionLogs.AddRange(batch);
                await db.SaveChangesAsync(cancellationToken);

                _logger.LogDebug("Saved batch of {Count} log entries", batch.Count);
            }, _logger, cancellationToken: cancellationToken);
        }
        catch (OperationCanceledException)
        {
            // Cancellation during save - try once more without cancellation token
            _logger.LogDebug("Save cancelled, attempting final save without cancellation");
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<LogsDbContext>();
                db.SessionLogs.AddRange(batch);
                await db.SaveChangesAsync(CancellationToken.None);
                _logger.LogDebug("Successfully saved {Count} log entries on retry", batch.Count);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to save {Count} log entries during shutdown", batch.Count);
            }
        }
    }

    private async Task FlushRemainingLogsAsync()
    {
        var remainingLogs = new List<SessionLogEntry>();
        while (_logChannel.Reader.TryRead(out var log))
        {
            remainingLogs.Add(log);
        }

        if (remainingLogs.Count > 0)
        {
            _logger.LogInformation("Flushing {Count} remaining log entries", remainingLogs.Count);
            // Use CancellationToken.None to ensure flush completes
            await SaveBatchAsync(remainingLogs, CancellationToken.None);
        }
    }
}
