namespace Innovatek.Parallel.MiniCluster.Api.Middleware;

public class RequestTimeoutMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestTimeoutMiddleware> _logger;
    private readonly TimeSpan _timeout;

    public RequestTimeoutMiddleware(
        RequestDelegate next, 
        ILogger<RequestTimeoutMiddleware> logger,
        TimeSpan? timeout = null)
    {
        _next = next;
        _logger = logger;
        _timeout = timeout ?? TimeSpan.FromSeconds(30);
    }

    public async Task InvokeAsync(HttpContext context)
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(context.RequestAborted);
        cts.CancelAfter(_timeout);

        try
        {
            await _next(context);
        }
        catch (OperationCanceledException) when (cts.Token.IsCancellationRequested && !context.RequestAborted.IsCancellationRequested)
        {
            _logger.LogWarning("Request timeout after {Timeout}s: {Path}", _timeout.TotalSeconds, context.Request.Path);
            context.Response.StatusCode = 408; // Request Timeout
            await context.Response.WriteAsync("Request timeout");
        }
    }
}

public static class RequestTimeoutMiddlewareExtensions
{
    public static IApplicationBuilder UseRequestTimeout(this IApplicationBuilder builder, TimeSpan? timeout = null)
    {
        return builder.UseMiddleware<RequestTimeoutMiddleware>(timeout);
    }
}
