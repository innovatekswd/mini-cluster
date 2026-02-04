using System.Collections.Concurrent;
using System.Runtime.InteropServices;
using Innovatek.Parallel.MiniCluster.Api.Services.Pty;

namespace Innovatek.Parallel.MiniCluster.Api.Services;

public interface ITerminalService
{
    Task<string> CreateTerminalAsync(string? workingDirectory = null, int cols = 120, int rows = 30);
    Task WriteAsync(string terminalId, string data);
    Task ResizeAsync(string terminalId, int cols, int rows);
    Task CloseAsync(string terminalId);
    bool TryGetTerminal(string terminalId, out TerminalSession? session);
    IEnumerable<string> GetActiveTerminalIds();
}

public class TerminalSession : IDisposable
{
    public string Id { get; }
    public IPtyConnection? PtyConnection { get; }
    public string WorkingDirectory { get; }
    public DateTime CreatedAt { get; }
    public CancellationTokenSource CancellationTokenSource { get; }
    public int Cols { get; set; }
    public int Rows { get; set; }
    
    public event Action<string>? OnData;
    public event Action<int>? OnExit;

    private bool _disposed;

    public TerminalSession(string id, IPtyConnection ptyConnection, string workingDirectory, int cols = 120, int rows = 30)
    {
        Id = id;
        PtyConnection = ptyConnection;
        WorkingDirectory = workingDirectory;
        CreatedAt = DateTime.UtcNow;
        CancellationTokenSource = new CancellationTokenSource();
        Cols = cols;
        Rows = rows;
    }

    public void RaiseOnData(string data) => OnData?.Invoke(data);
    public void RaiseOnExit(int exitCode) => OnExit?.Invoke(exitCode);

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        
        CancellationTokenSource.Cancel();
        CancellationTokenSource.Dispose();
        PtyConnection?.Dispose();
    }
}

public class TerminalService : ITerminalService, IDisposable
{
    private readonly ILogger<TerminalService> _logger;
    private readonly ConcurrentDictionary<string, TerminalSession> _terminals = new();
    private bool _disposed;

    public TerminalService(ILogger<TerminalService> logger)
    {
        _logger = logger;
    }

    public Task<string> CreateTerminalAsync(string? workingDirectory = null, int cols = 120, int rows = 30)
    {
        var terminalId = Guid.NewGuid().ToString("N")[..12];
        var cwd = workingDirectory ?? Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        
        // Check if PTY is supported on this platform
        if (!PtyProvider.IsSupported)
        {
            throw new PlatformNotSupportedException(
                $"PTY is not supported on this platform ({RuntimeInformation.OSDescription})");
        }

        // Determine shell based on platform
        string shell;
        string[] shellArgs;
        
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            // On Windows, use PowerShell or cmd
            shell = Environment.GetEnvironmentVariable("COMSPEC") ?? "cmd.exe";
            if (File.Exists(@"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"))
            {
                shell = @"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe";
                shellArgs = new[] { "-NoLogo" };
            }
            else
            {
                shellArgs = Array.Empty<string>();
            }
        }
        else
        {
            // On Linux/macOS, use bash or sh
            shell = File.Exists("/bin/bash") ? "/bin/bash" : "/bin/sh";
            shellArgs = new[] { "-l" }; // Login shell for proper initialization
        }

        _logger.LogInformation("Creating PTY terminal {TerminalId} with shell {Shell} in {Cwd}", 
            terminalId, shell, cwd);

        var options = new PtyOptions
        {
            Name = $"MiniCluster-{terminalId}",
            App = shell,
            CommandLine = shellArgs,
            Cwd = cwd,
            Cols = cols,
            Rows = rows,
            Environment = new Dictionary<string, string>
            {
                { "LANG", "en_US.UTF-8" },
            }
        };

        IPtyConnection ptyConnection;
        try
        {
            ptyConnection = PtyProvider.Spawn(options);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to spawn PTY for terminal {TerminalId}", terminalId);
            throw;
        }

        var session = new TerminalSession(terminalId, ptyConnection, cwd, cols, rows);
        
        if (!_terminals.TryAdd(terminalId, session))
        {
            session.Dispose();
            throw new InvalidOperationException("Failed to create terminal session");
        }

        // Subscribe to exit event
        ptyConnection.ProcessExited += (s, e) =>
        {
            _logger.LogInformation("Terminal {TerminalId} exited with code {ExitCode}", 
                terminalId, e.ExitCode);
            session.RaiseOnExit(e.ExitCode);
            _terminals.TryRemove(terminalId, out _);
        };

        // Start reading output
        _ = ReadOutputAsync(session);

        _logger.LogInformation("PTY terminal {TerminalId} created successfully (PID: {Pid})", 
            terminalId, ptyConnection.Pid);

        return Task.FromResult(terminalId);
    }

    private async Task ReadOutputAsync(TerminalSession session)
    {
        var buffer = new byte[4096];
        var token = session.CancellationTokenSource.Token;

        _logger.LogInformation("Starting output reader for terminal {TerminalId}", session.Id);

        try
        {
            while (!token.IsCancellationRequested && session.PtyConnection != null)
            {
                int bytesRead;
                try
                {
                    bytesRead = await Task.Run(() => session.PtyConnection.ReaderStream.Read(buffer, 0, buffer.Length), token);
                    _logger.LogDebug("Terminal {TerminalId} read {BytesRead} bytes", session.Id, bytesRead);
                }
                catch (IOException ex)
                {
                    _logger.LogDebug("Terminal {TerminalId} IO exception: {Message}", session.Id, ex.Message);
                    break;
                }

                if (bytesRead == 0)
                {
                    _logger.LogDebug("Terminal {TerminalId} EOF", session.Id);
                    break;
                }

                var data = System.Text.Encoding.UTF8.GetString(buffer, 0, bytesRead);
                _logger.LogDebug("Terminal {TerminalId} data: {Data}", session.Id, data.Length > 100 ? data[..100] + "..." : data);
                session.RaiseOnData(data);
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogDebug("Terminal {TerminalId} read cancelled", session.Id);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error reading from terminal {TerminalId}", session.Id);
        }
        
        _logger.LogInformation("Output reader ended for terminal {TerminalId}", session.Id);
    }

    public async Task WriteAsync(string terminalId, string data)
    {
        if (!_terminals.TryGetValue(terminalId, out var session))
        {
            throw new KeyNotFoundException($"Terminal {terminalId} not found");
        }

        if (session.PtyConnection == null)
        {
            throw new InvalidOperationException($"Terminal {terminalId} has no PTY connection");
        }

        _logger.LogDebug("Writing to terminal {TerminalId}: {Data}", terminalId, data.Length > 20 ? $"({data.Length} bytes)" : data.Replace("\r", "\\r").Replace("\n", "\\n"));
        
        var bytes = System.Text.Encoding.UTF8.GetBytes(data);
        await session.PtyConnection.WriterStream.WriteAsync(bytes);
        await session.PtyConnection.WriterStream.FlushAsync();
    }

    public Task ResizeAsync(string terminalId, int cols, int rows)
    {
        if (!_terminals.TryGetValue(terminalId, out var session))
        {
            throw new KeyNotFoundException($"Terminal {terminalId} not found");
        }

        session.Cols = cols;
        session.Rows = rows;
        
        if (session.PtyConnection != null)
        {
            try
            {
                session.PtyConnection.Resize(cols, rows);
                _logger.LogDebug("Terminal {TerminalId} resized to {Cols}x{Rows}", terminalId, cols, rows);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to resize terminal {TerminalId}", terminalId);
            }
        }
        
        return Task.CompletedTask;
    }

    public Task CloseAsync(string terminalId)
    {
        if (_terminals.TryRemove(terminalId, out var session))
        {
            _logger.LogInformation("Closing terminal {TerminalId}", terminalId);
            session.Dispose();
        }
        
        return Task.CompletedTask;
    }

    public bool TryGetTerminal(string terminalId, out TerminalSession? session)
    {
        return _terminals.TryGetValue(terminalId, out session);
    }

    public IEnumerable<string> GetActiveTerminalIds()
    {
        return _terminals.Keys.ToList();
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        foreach (var terminal in _terminals.Values)
        {
            try
            {
                terminal.Dispose();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error disposing terminal {TerminalId}", terminal.Id);
            }
        }
        
        _terminals.Clear();
    }
}
