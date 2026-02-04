using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.EntityFrameworkCore;
using System.Diagnostics;
using System.Collections.Concurrent;
using Innovatek.Parallel.MiniCluster.Api.Hubs;
using Microsoft.AspNetCore.SignalR;
using System.Text.Json;

namespace Innovatek.Parallel.MiniCluster.Api.Services;

public interface IServiceProcessManager
{
    Task<ServiceStartResult> StartServiceAsync(Guid serviceId, string triggeredBy = "manual");
    Task<bool> StopServiceAsync(Guid serviceId);
    ServiceRuntimeStatus GetStatus(Guid serviceId);
    Dictionary<Guid, ServiceRuntimeStatus> GetAllStatuses();
}

public class ServiceStartResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public string? ErrorDetails { get; set; }
}

public enum ServiceRuntimeStatus
{
    NotFound,
    Running,
    Stopped,
    Starting,
    Stopping,
    Failed
}

public class SessionMetadata
{
    public required Guid ServiceId { get; set; }
    public required Service Service { get; set; }
    public required ServiceSession Session { get; set; }
    public required Process Process { get; set; }
}

public class ServiceProcessManager : IServiceProcessManager
{
    private readonly ILogger<ServiceProcessManager> _logger;

    // Maps serviceId → Process
    private readonly ConcurrentDictionary<Guid, SessionMetadata> _runningServices = new();

    private readonly IHubContext<LogHub> _hub;

    private readonly IServiceScopeFactory _scopeFactory;
    
    private readonly ILogBatchService _logBatchService;

    public ServiceProcessManager(
        IServiceScopeFactory scopeFactory, 
        ILogger<ServiceProcessManager> logger, 
        IHubContext<LogHub> hub,
        ILogBatchService logBatchService)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _hub = hub;
        _logBatchService = logBatchService;
    }



    public async Task<ServiceStartResult> StartServiceAsync(Guid serviceId, string triggeredBy = "manual")
    {
        using var scope = _scopeFactory.CreateScope();
        var controlDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var logsDb = scope.ServiceProvider.GetRequiredService<LogsDbContext>();

        var service = await controlDb.Services.AsNoTracking().FirstOrDefaultAsync(s => s.Id == serviceId);
        if (service == null)
        {
            _logger.LogWarning($"Service with ID {serviceId} not found");
            return new ServiceStartResult { Success = false, ErrorMessage = "Service not found", ErrorDetails = $"No service exists with ID {serviceId}" };
        }

        if (_runningServices.ContainsKey(serviceId))
        {
            _logger.LogWarning($"Service '{service.Name}' is already running");
            return new ServiceStartResult { Success = false, ErrorMessage = "Service is already running", ErrorDetails = $"Service '{service.Name}' is currently active" };
        }

        try
        {
            // Resolve executable path if it's just a command name (e.g., "dotnet" instead of full path)
            string? resolvedExecutablePath = service.ExecutablePath;
            if (!File.Exists(service.ExecutablePath) && !service.IsExternal)
            {
                // Try to resolve from PATH
                resolvedExecutablePath = ResolveExecutableFromPath(service.ExecutablePath);
                
                if (resolvedExecutablePath == null)
                {
                    _logger.LogError($"Executable not found: {service.ExecutablePath}");
                    await UpdateServiceStatus(serviceId, scope, ServiceRuntimeStatus.Failed);
                    return new ServiceStartResult 
                    { 
                        Success = false, 
                        ErrorMessage = "Executable not found", 
                        ErrorDetails = $"The executable '{service.ExecutablePath}' does not exist and could not be found in PATH. Please verify the path is correct or use the full path to the executable." 
                    };
                }
                
                _logger.LogInformation($"Resolved '{service.ExecutablePath}' to '{resolvedExecutablePath}'");
            }

            // Check if executable has execute permissions (Linux/Unix/macOS)
            if (!service.IsExternal && !OperatingSystem.IsWindows())
            {
                try
                {
                    var fileInfo = new FileInfo(resolvedExecutablePath);
                    // Check if we can access the file
                    if (!fileInfo.Exists)
                    {
                        return new ServiceStartResult 
                        { 
                            Success = false, 
                            ErrorMessage = "Executable not accessible", 
                            ErrorDetails = $"Cannot access '{resolvedExecutablePath}'. Check file permissions." 
                        };
                    }
                    
                    // On Unix-like systems, try to detect permission issues early
                    // Note: The actual execute permission will be validated when process starts
                }
                catch (UnauthorizedAccessException)
                {
                    return new ServiceStartResult 
                    { 
                        Success = false, 
                        ErrorMessage = "Permission denied", 
                        ErrorDetails = $"No permission to access '{resolvedExecutablePath}'. Make sure the file has execute permissions: chmod +x '{resolvedExecutablePath}'" 
                    };
                }
            }

            // Validate working directory exists
            if (!string.IsNullOrWhiteSpace(service.WorkingDirectory) && !Directory.Exists(service.WorkingDirectory))
            {
                _logger.LogError($"Working directory not found: {service.WorkingDirectory}");
                return new ServiceStartResult 
                { 
                    Success = false, 
                    ErrorMessage = "Working directory not found", 
                    ErrorDetails = $"The working directory '{service.WorkingDirectory}' does not exist. Please create it or specify a valid directory." 
                };
            }

            // Update status to 'Starting'
            await UpdateServiceStatus(serviceId, scope, ServiceRuntimeStatus.Starting);

            // Create a new session (i.e. a run-instance of the service)
            var session = new ServiceSession
            {
                ServiceId = serviceId,
                AutoStart = triggeredBy != "manual",
                WorkingDirectory = 
                String.IsNullOrWhiteSpace(service.WorkingDirectory)
                ? Path.GetDirectoryName(service.ExecutablePath) : service.WorkingDirectory,
                // Serialize service.EnvironmentVariables to JSON (implement Serialize as needed)
                EnvironmentSnapshot = JsonSerializer.Serialize(service.EnvironmentVariables),

                CommandLineArguments = service.Arguments,
                StartTimestamp = DateTime.UtcNow
            };

            await logsDb.ServiceSessions.AddAsync(session);
            await logsDb.SaveChangesAsync();

            // Determine if we should capture output: 0 (auto) = capture when UseShellExecute is false, 1 = always, 2 = never
            bool shouldCaptureOutput = service.CaptureOutput == 0 ? !service.UseShellExecute : service.CaptureOutput == 1;
            
            // Log configuration
            if (service.CaptureOutput == 0)
            {
                _logger.LogInformation($"Service '{service.Name}' configured with CaptureOutput=Auto. Will capture: {shouldCaptureOutput} (based on UseShellExecute={service.UseShellExecute})");
            }
            else if (service.UseShellExecute && service.CaptureOutput == 1)
            {
                _logger.LogWarning($"Service '{service.Name}' configured with UseShellExecute=true AND CaptureOutput=Always. Output redirection will be attempted but may fail. Consider setting CaptureOutput=Auto or UseShellExecute=false.");
            }
            else if (service.CaptureOutput == 2)
            {
                _logger.LogInformation($"Service '{service.Name}' configured with CaptureOutput=Never. No output will be captured.");
            }

            // Set up process start info with resolved executable path
            var startInfo = new ProcessStartInfo
            {
                FileName = resolvedExecutablePath,
                Arguments = service.Arguments,
                UseShellExecute = service.UseShellExecute,
                RedirectStandardOutput = shouldCaptureOutput,
                RedirectStandardError = shouldCaptureOutput,
                WorkingDirectory = session.WorkingDirectory ,
                CreateNoWindow = service.CreateNoWindow,

            };

            foreach (var kvp in service.EnvironmentVariables)
            {
                startInfo.Environment[kvp.Key] = kvp.Value;
            }

            var process = new Process
            {
                StartInfo = startInfo,
                EnableRaisingEvents = true,
                
            };

            var sessionMetadata = new SessionMetadata()
            {
                Process = process,
                ServiceId = serviceId,
                Service = service,
                Session = session
            };

            // Update session on process exit
            process.Exited += (sender, args) =>
            {
                // Fire and forget pattern - intentionally not awaited
                _ = Task.Run(async () =>
                {
                    try
                    {
                        await HandleExitEvent(sessionMetadata);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error handling process exit for service {ServiceName}", sessionMetadata.Service.Name);
                    }
                });
            };

            // Only set up log handlers if output capture is enabled
            if (shouldCaptureOutput)
            {
                // Handle standard output
                process.OutputDataReceived += (sender, e) =>
                {
                    if (!string.IsNullOrWhiteSpace(e.Data))
                    {
                        // Fire and forget pattern
                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                // Send log over SignalR to clients
                                await _hub.Clients.Group(serviceId.ToString()).SendAsync("ReceiveLog", new
                                {
                                    ServiceId = serviceId,
                                    SessionId = session.SessionId,
                                    Type = "stdout",
                                    Timestamp = DateTime.UtcNow,
                                    Line = e.Data
                                });
                            }
                            catch (Exception ex)
                            {
                                _logger.LogWarning(ex, "Failed to send log via SignalR");
                            }

                            // Queue log for batched database write
                            _logBatchService.QueueLog(new SessionLogEntry
                            {
                                SessionId = session.SessionId,
                                LogType = "stdout",
                                Timestamp = DateTime.UtcNow,
                                Line = e.Data
                            });
                        });
                    }
                };

                // Handle standard error
                process.ErrorDataReceived += (sender, e) =>
                {
                    if (!string.IsNullOrWhiteSpace(e.Data))
                    {
                        // Fire and forget pattern
                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                await _hub.Clients.Group(serviceId.ToString()).SendAsync("ReceiveLog", new
                                {
                                    ServiceId = serviceId,
                                    SessionId = session.SessionId,
                                    Type = "stderr",
                                    Timestamp = DateTime.UtcNow,
                                    Line = e.Data
                                });
                            }
                            catch (Exception ex)
                            {
                                _logger.LogWarning(ex, "Failed to send error log via SignalR");
                            }

                            // Queue log for batched database write
                            _logBatchService.QueueLog(new SessionLogEntry
                            {
                                SessionId = session.SessionId,
                                LogType = "stderr",
                                Timestamp = DateTime.UtcNow,
                                Line = e.Data
                            });
                        });
                    }
                };
            }

            try
            {
                if (process.Start())
                {
                    // Only begin reading if we're capturing output
                    if (shouldCaptureOutput)
                    {
                        process.BeginOutputReadLine();
                        process.BeginErrorReadLine();
                    }
                    
                    await UpdateServiceStatus(serviceId, scope, ServiceRuntimeStatus.Running);

                    _runningServices[serviceId] = sessionMetadata;
                    string captureMode = service.CaptureOutput == 0 ? "Auto" : (service.CaptureOutput == 1 ? "Always" : "Never");
                    _logger.LogInformation($"Started service '{service.Name}' with PID {process.Id} (UseShellExecute={service.UseShellExecute}, CaptureOutput={captureMode}, Capturing={shouldCaptureOutput})");
                    return new ServiceStartResult { Success = true };
                }
                else
                {
                    _logger.LogError($"Process.Start() returned false for '{service.Name}'");
                    await UpdateServiceStatus(serviceId, scope, ServiceRuntimeStatus.Failed);
                    string captureMode = service.CaptureOutput == 0 ? "Auto" : (service.CaptureOutput == 1 ? "Always" : "Never");
                    return new ServiceStartResult 
                    { 
                        Success = false, 
                        ErrorMessage = "Process failed to start", 
                        ErrorDetails = $"The system was unable to start the process '{service.Name}'. The executable may be corrupted, incompatible, or missing dependencies. UseShellExecute={service.UseShellExecute}, CaptureOutput={captureMode}" 
                    };
                }
            }
            catch (System.ComponentModel.Win32Exception ex)
            {
                // Handle both Windows and Linux error codes
                var details = ex.NativeErrorCode switch
                {
                    // Common to both platforms
                    2 => $"File not found: '{resolvedExecutablePath}' does not exist.",
                    
                    // Windows-specific codes
                    5 => $"Access denied: No permission to execute '{resolvedExecutablePath}'. Check file permissions.", // Windows ERROR_ACCESS_DENIED
                    193 => $"Not a valid executable: '{resolvedExecutablePath}' is not a valid Windows application.", // Windows ERROR_BAD_EXE_FORMAT
                    1223 => "Operation cancelled by user.", // Windows ERROR_CANCELLED
                    
                    // Linux-specific codes (errno values)
                    8 => $"Invalid executable format: '{resolvedExecutablePath}' cannot be executed (wrong architecture or corrupted).", // Linux ENOEXEC
                    13 => $"Permission denied: No execute permission for '{resolvedExecutablePath}'. Run: chmod +x '{resolvedExecutablePath}'", // Linux EACCES
                    20 => $"Not a directory: The working directory path is invalid.", // Linux ENOTDIR
                    21 => $"Is a directory: '{resolvedExecutablePath}' is a directory, not an executable file.", // Linux EISDIR
                    
                    _ => $"System error (code {ex.NativeErrorCode}): {ex.Message}"
                };
                
                _logger.LogError(ex, $"Win32Exception starting '{service.Name}' (UseShellExecute={service.UseShellExecute}): {details}");
                await UpdateServiceStatus(serviceId, scope, ServiceRuntimeStatus.Failed);
                return new ServiceStartResult 
                { 
                    Success = false, 
                    ErrorMessage = "Process start failed", 
                    ErrorDetails = $"{details} (UseShellExecute={service.UseShellExecute})"
                };
            }
            catch (UnauthorizedAccessException ex)
            {
                _logger.LogError(ex, $"Permission denied starting '{service.Name}' (UseShellExecute={service.UseShellExecute})");
                await UpdateServiceStatus(serviceId, scope, ServiceRuntimeStatus.Failed);
                return new ServiceStartResult 
                { 
                    Success = false, 
                    ErrorMessage = "Permission denied", 
                    ErrorDetails = $"No permission to execute '{resolvedExecutablePath}'. Ensure the file has execute permissions and you have the necessary access rights. (UseShellExecute={service.UseShellExecute})"
                };
            }
            catch (FileNotFoundException ex)
            {
                _logger.LogError(ex, $"File not found: '{service.Name}' (UseShellExecute={service.UseShellExecute})");
                await UpdateServiceStatus(serviceId, scope, ServiceRuntimeStatus.Failed);
                return new ServiceStartResult 
                { 
                    Success = false, 
                    ErrorMessage = "File not found", 
                    ErrorDetails = $"Could not find '{ex.FileName}'. The executable or one of its dependencies may be missing. (UseShellExecute={service.UseShellExecute})"
                };
            }
            catch (InvalidOperationException ex)
            {
                // Check if this is the UseShellExecute + stream redirection conflict
                string errorDetails;
                if (ex.Message.Contains("UseShellExecute") && ex.Message.Contains("redirect"))
                {
                    errorDetails = $"Configuration conflict: Cannot redirect output streams (capture logs) when UseShellExecute=true. " +
                                 $"Solution: Either set UseShellExecute=false to enable log capture, or set CaptureOutput=2 (Never) to disable log capture. " +
                                 $"Current settings: UseShellExecute={service.UseShellExecute}, CaptureOutput={service.CaptureOutput}. " +
                                 $"OS Error: {ex.Message}";
                }
                else
                {
                    errorDetails = $"Process configuration error: {ex.Message} (UseShellExecute={service.UseShellExecute}, CaptureOutput={service.CaptureOutput})";
                }
                
                _logger.LogError(ex, $"Invalid operation starting '{service.Name}': {errorDetails}");
                await UpdateServiceStatus(serviceId, scope, ServiceRuntimeStatus.Failed);
                return new ServiceStartResult 
                { 
                    Success = false, 
                    ErrorMessage = "Invalid process configuration", 
                    ErrorDetails = errorDetails
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Unexpected exception starting '{service.Name}' (UseShellExecute={service.UseShellExecute}): {ex.Message}");
                await UpdateServiceStatus(serviceId, scope, ServiceRuntimeStatus.Failed);
                return new ServiceStartResult 
                { 
                    Success = false, 
                    ErrorMessage = "Exception occurred during start", 
                    ErrorDetails = $"Error starting '{service.Name}': {ex.GetType().Name} - {ex.Message} (UseShellExecute={service.UseShellExecute})" 
                };
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to start service '{service?.Name}'");
            return new ServiceStartResult 
            { 
                Success = false, 
                ErrorMessage = "Unexpected error", 
                ErrorDetails = $"An unexpected error occurred: {ex.Message}" 
            };
        }
    }

    private async Task HandleExitEvent(SessionMetadata metadata)
    {
        using var scopeEx = _scopeFactory.CreateScope();
        var logsDb = scopeEx.ServiceProvider.GetRequiredService<LogsDbContext>();

        // Update status to 'Stopped'
        await UpdateServiceStatus(metadata.ServiceId, scopeEx, ServiceRuntimeStatus.Stopped);

        // Retrieve the session and update its end properties
        var existingSession = await logsDb.ServiceSessions.FindAsync(metadata.Session.SessionId);
        if (existingSession != null)
        {
            existingSession.EndTimestamp = DateTime.UtcNow;
            existingSession.ExitReason = "process";
            existingSession.ExitCode = metadata.Process.ExitCode;
            await logsDb.SaveChangesAsync();
        }

        _runningServices.TryRemove(metadata.ServiceId, out _);
        _logger.LogInformation($"Service '{metadata.Service.Name}' exited with code {metadata.Process.ExitCode}");
    }

    private async Task UpdateServiceStatus(Guid serviceId, IServiceScope scope, ServiceRuntimeStatus status)
    {
        var _mgr = scope.ServiceProvider.GetRequiredService<IServiceProcessManager>();
        await _hub.Clients.Group(serviceId.ToString()).SendAsync(
            "StatusUpdated",
            serviceId,
            new { status = status.ToString() }
        );
    }

    public async Task<bool> StopServiceAsync(Guid serviceId)
    {
        if (_runningServices.TryRemove(serviceId, out var sessionMetadata))
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var logsDb = scope.ServiceProvider.GetRequiredService<LogsDbContext>();

                await logsDb.LifecycleEvents.AddAsync(new ServiceLifecycleEvent
                {
                    ServiceId = serviceId,
                    EventType = ServiceLifecycleEventType.Stopped,
                    TriggeredBy = "manual"
                });
                await logsDb.SaveChangesAsync();

                if (!sessionMetadata.Process.HasExited)
                {
                    sessionMetadata.Process.Kill(true);
                    await sessionMetadata.Process.WaitForExitAsync();
                }

                // Update session metadata
                var existingSession = await logsDb.ServiceSessions.FindAsync(sessionMetadata.Session.SessionId);
                if (existingSession != null && existingSession.EndTimestamp == null)
                {
                    existingSession.EndTimestamp = DateTime.UtcNow;
                    existingSession.ExitReason = "manual";
                    existingSession.ExitCode = sessionMetadata.Process.ExitCode;
                    await logsDb.SaveChangesAsync();
                }

                sessionMetadata.Process.Dispose();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to stop service with ID {serviceId}");
            }
        }
        return false;
    }

    public ServiceRuntimeStatus GetStatus(Guid serviceId)
    {
        if (_runningServices.TryGetValue(serviceId, out var sessionMetadata))
        {
            return sessionMetadata.Process.HasExited ? ServiceRuntimeStatus.Stopped : ServiceRuntimeStatus.Running;
        }

        return ServiceRuntimeStatus.Stopped;
    }

    public Dictionary<Guid, ServiceRuntimeStatus> GetAllStatuses()
    {
        var result = new Dictionary<Guid, ServiceRuntimeStatus>();
        foreach (var kvp in _runningServices)
        {
            result[kvp.Key] = kvp.Value.Process.HasExited ? ServiceRuntimeStatus.Stopped : ServiceRuntimeStatus.Running;
        }
        return result;
    }

    /// <summary>
    /// Resolves an executable name to its full path by searching the system PATH.
    /// Returns null if not found.
    /// </summary>
    private string? ResolveExecutableFromPath(string executableName)
    {
        // If it's already a full path or contains path separators, don't resolve
        if (Path.IsPathRooted(executableName) || executableName.Contains(Path.DirectorySeparatorChar) || executableName.Contains(Path.AltDirectorySeparatorChar))
        {
            return File.Exists(executableName) ? executableName : null;
        }

        // Get PATH environment variable
        var pathEnv = Environment.GetEnvironmentVariable("PATH");
        if (string.IsNullOrWhiteSpace(pathEnv))
        {
            return null;
        }

        // On Windows, add .exe extension if not already present
        var executablesToTry = new List<string> { executableName };
        if (OperatingSystem.IsWindows())
        {
            if (!executableName.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
            {
                executablesToTry.Add(executableName + ".exe");
            }
            // Also try .cmd, .bat for Windows batch files
            executablesToTry.Add(executableName + ".cmd");
            executablesToTry.Add(executableName + ".bat");
        }

        // Split PATH and search for executable
        var pathDirectories = pathEnv.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries);
        
        foreach (var directory in pathDirectories)
        {
            foreach (var executableToTry in executablesToTry)
            {
                try
                {
                    var fullPath = Path.Combine(directory, executableToTry);
                    if (File.Exists(fullPath))
                    {
                        return fullPath;
                    }
                }
                catch
                {
                    // Ignore invalid paths
                    continue;
                }
            }
        }

        return null;
    }

}
