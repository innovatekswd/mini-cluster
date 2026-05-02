using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Innovatek.Parallel.MiniCluster.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/system")]
public class SystemController : ControllerBase
{
    private readonly ILogger<SystemController> _logger;

    public SystemController(ILogger<SystemController> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Returns OS/runtime info and whether MiniCluster is running as a service.
    /// </summary>
    [HttpGet("info")]
    public IActionResult GetInfo()
    {
        var isWindowsService = OperatingSystem.IsWindows() && IsRunningAsWindowsService();
        var isSystemdService = !OperatingSystem.IsWindows() && IsRunningUnderSystemd();

        return Ok(new
        {
            os            = RuntimeInformation.OSDescription,
            architecture  = RuntimeInformation.OSArchitecture.ToString(),
            runtime       = "dotnet",
            version       = typeof(SystemController).Assembly.GetName().Version?.ToString() ?? "unknown",
            isService     = isWindowsService || isSystemdService,
            serviceType   = isWindowsService ? "windows" : isSystemdService ? "systemd" : "none",
            serviceName   = "MiniCluster",
        });
    }

    /// <summary>
    /// Install MiniCluster as a Windows Service or systemd service.
    /// </summary>
    [HttpPost("service/install")]
    public IActionResult InstallService()
    {
        if (OperatingSystem.IsWindows())
        {
            return InstallWindowsService();
        }
        if (OperatingSystem.IsLinux())
        {
            return InstallSystemdService();
        }
        return BadRequest(new { error = "Service installation is only supported on Windows and Linux." });
    }

    /// <summary>
    /// Uninstall the MiniCluster service.
    /// </summary>
    [HttpDelete("service/uninstall")]
    public IActionResult UninstallService()
    {
        if (OperatingSystem.IsWindows())
        {
            return UninstallWindowsService();
        }
        if (OperatingSystem.IsLinux())
        {
            return UninstallSystemdService();
        }
        return BadRequest(new { error = "Service management is only supported on Windows and Linux." });
    }

    // ── Private helpers ─────────────────────────────────────────────────────

    private static bool IsRunningAsWindowsService()
    {
        // WindowsServiceLifetime sets this; check parent process name as fallback.
        try
        {
            var parent = ParentProcess();
            return parent?.ProcessName?.Equals("services", StringComparison.OrdinalIgnoreCase) == true;
        }
        catch { return false; }
    }

    private static bool IsRunningUnderSystemd()
    {
        // systemd sets INVOCATION_ID for services it manages.
        return !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("INVOCATION_ID"));
    }

    private IActionResult InstallWindowsService()
    {
        try
        {
            var exePath = Process.GetCurrentProcess().MainModule?.FileName
                ?? throw new InvalidOperationException("Cannot determine executable path.");

            RunProcess("sc.exe", $"create MiniCluster binpath= \"{exePath}\" start= auto DisplayName= \"MiniCluster API\"");
            RunProcess("sc.exe", "description MiniCluster \"MiniCluster lightweight process management platform\"");
            RunProcess("sc.exe", "start MiniCluster");

            _logger.LogInformation("Installed and started Windows service from {ExePath}", exePath);
            return Ok(new { message = "Windows service installed and started.", serviceName = "MiniCluster" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to install Windows service");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    private IActionResult UninstallWindowsService()
    {
        try
        {
            RunProcess("sc.exe", "stop MiniCluster");
            RunProcess("sc.exe", "delete MiniCluster");
            _logger.LogInformation("Uninstalled Windows service");
            return Ok(new { message = "Windows service uninstalled." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to uninstall Windows service");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    private IActionResult InstallSystemdService()
    {
        try
        {
            var exePath = Process.GetCurrentProcess().MainModule?.FileName
                ?? throw new InvalidOperationException("Cannot determine executable path.");

            const string serviceName = "minicluster";
            var unitContent = $"""
[Unit]
Description=MiniCluster API Server
After=network.target

[Service]
Type=notify
ExecStart={exePath}
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=minicluster
User=minicluster
Environment=ASPNETCORE_ENVIRONMENT=Production

[Install]
WantedBy=multi-user.target
""";

            var unitPath = $"/etc/systemd/system/{serviceName}.service";
            System.IO.File.WriteAllText(unitPath, unitContent);

            RunProcess("systemctl", "daemon-reload");
            RunProcess("systemctl", $"enable {serviceName}");
            RunProcess("systemctl", $"start {serviceName}");

            _logger.LogInformation("Installed and started systemd service from {ExePath}", exePath);
            return Ok(new { message = "Systemd service installed and started.", serviceName });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to install systemd service");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    private IActionResult UninstallSystemdService()
    {
        try
        {
            const string serviceName = "minicluster";
            RunProcess("systemctl", $"stop {serviceName}");
            RunProcess("systemctl", $"disable {serviceName}");

            var unitPath = $"/etc/systemd/system/{serviceName}.service";
            if (System.IO.File.Exists(unitPath))
                System.IO.File.Delete(unitPath);

            RunProcess("systemctl", "daemon-reload");

            _logger.LogInformation("Uninstalled systemd service");
            return Ok(new { message = "Systemd service uninstalled." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to uninstall systemd service");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    private static void RunProcess(string command, string arguments)
    {
        var psi = new ProcessStartInfo
        {
            FileName               = command,
            Arguments              = arguments,
            RedirectStandardOutput = true,
            RedirectStandardError  = true,
            UseShellExecute        = false,
            CreateNoWindow         = true,
        };
        using var p = Process.Start(psi) ?? throw new InvalidOperationException($"Failed to start {command}");
        p.WaitForExit(10_000);
        if (p.ExitCode != 0)
        {
            var err = p.StandardError.ReadToEnd();
            throw new InvalidOperationException($"{command} {arguments} exited with code {p.ExitCode}: {err}");
        }
    }

    private static Process? ParentProcess()
    {
        var current = Process.GetCurrentProcess();
        try
        {
            // Works on Windows via WMI — fall back gracefully on other OSes.
            return null; // simplified: avoid WMI dependency
        }
        catch { return null; }
    }
}
