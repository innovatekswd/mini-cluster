using Microsoft.EntityFrameworkCore;

namespace Innovatek.Parallel.MiniCluster.Api.Helpers;

public static class DatabaseRetryHelper
{
    public static async Task<T> ExecuteWithRetryAsync<T>(
        Func<Task<T>> operation,
        ILogger logger,
        int maxRetries = 3,
        int baseDelayMs = 100,
        CancellationToken cancellationToken = default)
    {
        for (int attempt = 0; attempt < maxRetries; attempt++)
        {
            try
            {
                return await operation();
            }
            catch (DbUpdateException ex) when (IsDatabaseLockError(ex) && attempt < maxRetries - 1)
            {
                logger.LogWarning("Database locked, retrying ({Attempt}/{MaxRetries})", attempt + 1, maxRetries);
                await Task.Delay(baseDelayMs * (attempt + 1), cancellationToken); // Exponential backoff
            }
            catch (Exception ex) when (ex.Message.Contains("database is locked") && attempt < maxRetries - 1)
            {
                logger.LogWarning("Database locked, retrying ({Attempt}/{MaxRetries})", attempt + 1, maxRetries);
                await Task.Delay(baseDelayMs * (attempt + 1), cancellationToken);
            }
        }

        // Final attempt without catching
        return await operation();
    }

    public static async Task ExecuteWithRetryAsync(
        Func<Task> operation,
        ILogger logger,
        int maxRetries = 3,
        int baseDelayMs = 100,
        CancellationToken cancellationToken = default)
    {
        await ExecuteWithRetryAsync<object?>(async () =>
        {
            await operation();
            return null;
        }, logger, maxRetries, baseDelayMs, cancellationToken);
    }

    private static bool IsDatabaseLockError(DbUpdateException ex)
    {
        return ex.InnerException?.Message.Contains("database is locked") ?? false;
    }
}
