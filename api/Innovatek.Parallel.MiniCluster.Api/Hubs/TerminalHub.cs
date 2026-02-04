using Microsoft.AspNetCore.SignalR;
using Innovatek.Parallel.MiniCluster.Api.Services;

namespace Innovatek.Parallel.MiniCluster.Api.Hubs;

public class TerminalHub : Hub
{
    private readonly ITerminalService _terminalService;
    private readonly ILogger<TerminalHub> _logger;
    private readonly IHubContext<TerminalHub> _hubContext;

    public TerminalHub(
        ITerminalService terminalService, 
        ILogger<TerminalHub> logger,
        IHubContext<TerminalHub> hubContext)
    {
        _terminalService = terminalService;
        _logger = logger;
        _hubContext = hubContext;
    }

    /// <summary>
    /// Creates a new terminal session
    /// </summary>
    public async Task<string> CreateTerminal(string? workingDirectory = null, int cols = 120, int rows = 30)
    {
        try
        {
            var terminalId = await _terminalService.CreateTerminalAsync(workingDirectory, cols, rows);
            
            // Subscribe to terminal events
            if (_terminalService.TryGetTerminal(terminalId, out var session) && session != null)
            {
                var connectionId = Context.ConnectionId;
                
                // Use _hubContext instead of Clients - hubContext lives beyond the hub instance
                session.OnData += async (data) =>
                {
                    try
                    {
                        await _hubContext.Clients.Client(connectionId).SendAsync("TerminalData", terminalId, data);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to send terminal data to client {ConnectionId}", connectionId);
                    }
                };

                session.OnExit += async (exitCode) =>
                {
                    try
                    {
                        await _hubContext.Clients.Client(connectionId).SendAsync("TerminalExit", terminalId, exitCode);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to send terminal exit to client {ConnectionId}", connectionId);
                    }
                };
            }

            // Add to group for this terminal
            await Groups.AddToGroupAsync(Context.ConnectionId, $"terminal-{terminalId}");
            
            _logger.LogInformation("Client {ConnectionId} created terminal {TerminalId}", 
                Context.ConnectionId, terminalId);

            return terminalId;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create terminal for client {ConnectionId}", Context.ConnectionId);
            throw;
        }
    }

    /// <summary>
    /// Writes data to a terminal (user input)
    /// </summary>
    public async Task WriteToTerminal(string terminalId, string data)
    {
        try
        {
            await _terminalService.WriteAsync(terminalId, data);
        }
        catch (KeyNotFoundException)
        {
            await Clients.Caller.SendAsync("TerminalError", terminalId, "Terminal not found");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to write to terminal {TerminalId}", terminalId);
            await Clients.Caller.SendAsync("TerminalError", terminalId, "Failed to write to terminal");
        }
    }

    /// <summary>
    /// Resizes the terminal
    /// </summary>
    public async Task ResizeTerminal(string terminalId, int cols, int rows)
    {
        try
        {
            await _terminalService.ResizeAsync(terminalId, cols, rows);
        }
        catch (KeyNotFoundException)
        {
            await Clients.Caller.SendAsync("TerminalError", terminalId, "Terminal not found");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to resize terminal {TerminalId}", terminalId);
        }
    }

    /// <summary>
    /// Closes a terminal session
    /// </summary>
    public async Task CloseTerminal(string terminalId)
    {
        try
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"terminal-{terminalId}");
            await _terminalService.CloseAsync(terminalId);
            
            _logger.LogInformation("Client {ConnectionId} closed terminal {TerminalId}", 
                Context.ConnectionId, terminalId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to close terminal {TerminalId}", terminalId);
        }
    }

    /// <summary>
    /// Gets list of active terminals
    /// </summary>
    public IEnumerable<string> GetActiveTerminals()
    {
        return _terminalService.GetActiveTerminalIds();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("Client {ConnectionId} disconnected from TerminalHub", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}
