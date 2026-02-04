using Microsoft.AspNetCore.Diagnostics;
using System.Net;
using System.Text.Json;

namespace Innovatek.Parallel.MiniCluster.Api.Middleware;

public class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;

    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger)
    {
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        _logger.LogError(exception, "An unhandled exception occurred: {Message}", exception.Message);

        var problemDetails = new
        {
            Status = (int)HttpStatusCode.InternalServerError,
            Title = "An error occurred while processing your request.",
            Detail = exception.Message,
            Instance = httpContext.Request.Path,
            Timestamp = DateTime.UtcNow
        };

        httpContext.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
        httpContext.Response.ContentType = "application/json";

        await httpContext.Response.WriteAsync(
            JsonSerializer.Serialize(problemDetails),
            cancellationToken);

        return true;
    }
}
