// Based on Microsoft's vs-pty.net (MIT License)
// https://github.com/microsoft/vs-pty.net

using System.Runtime.InteropServices;
using static Innovatek.Parallel.MiniCluster.Api.Services.Pty.PtyNativeMethods;

namespace Innovatek.Parallel.MiniCluster.Api.Services.Pty;

/// <summary>
/// Options for spawning a new PTY process.
/// </summary>
public class PtyOptions
{
    /// <summary>
    /// Gets or sets the terminal name.
    /// </summary>
    public string? Name { get; set; }

    /// <summary>
    /// Gets or sets the number of initial rows.
    /// </summary>
    public int Rows { get; set; } = 30;

    /// <summary>
    /// Gets or sets the number of initial columns.
    /// </summary>
    public int Cols { get; set; } = 120;

    /// <summary>
    /// Gets or sets the working directory for the spawned process.
    /// </summary>
    public string Cwd { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the path to the process to be spawned.
    /// </summary>
    public string App { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the command line arguments to the process.
    /// </summary>
    public string[] CommandLine { get; set; } = Array.Empty<string>();

    /// <summary>
    /// Gets or sets the environment variables.
    /// </summary>
    public IDictionary<string, string> Environment { get; set; } = new Dictionary<string, string>();
}

/// <summary>
/// Event args for process exit.
/// </summary>
public class PtyExitedEventArgs : EventArgs
{
    public PtyExitedEventArgs(int exitCode)
    {
        ExitCode = exitCode;
    }

    public int ExitCode { get; }
}

/// <summary>
/// Connection to a running pseudoterminal process.
/// </summary>
public interface IPtyConnection : IDisposable
{
    /// <summary>
    /// Event fired when the pty process exits.
    /// </summary>
    event EventHandler<PtyExitedEventArgs>? ProcessExited;

    /// <summary>
    /// Gets the stream for reading data from the pty.
    /// </summary>
    Stream ReaderStream { get; }

    /// <summary>
    /// Gets the stream for writing data to the pty.
    /// </summary>
    Stream WriterStream { get; }

    /// <summary>
    /// Gets the pty process ID.
    /// </summary>
    int Pid { get; }

    /// <summary>
    /// Gets the pty process exit code.
    /// </summary>
    int ExitCode { get; }

    /// <summary>
    /// Wait for the pty process to exit up to a given timeout.
    /// </summary>
    bool WaitForExit(int milliseconds);

    /// <summary>
    /// Immediately terminates the pty process.
    /// </summary>
    void Kill();

    /// <summary>
    /// Change the size of the pty.
    /// </summary>
    void Resize(int cols, int rows);

    /// <summary>
    /// Gets whether the process is still alive.
    /// </summary>
    bool IsAlive { get; }
}

/// <summary>
/// Stream wrapper for PTY file descriptor.
/// </summary>
internal class PtyStream : Stream
{
    private readonly int _fd;
    private readonly FileAccess _access;
    private bool _disposed;

    public PtyStream(int fd, FileAccess access)
    {
        _fd = fd;
        _access = access;
    }

    public override bool CanRead => _access == FileAccess.Read || _access == FileAccess.ReadWrite;
    public override bool CanSeek => false;
    public override bool CanWrite => _access == FileAccess.Write || _access == FileAccess.ReadWrite;
    public override long Length => throw new NotSupportedException();
    public override long Position
    {
        get => throw new NotSupportedException();
        set => throw new NotSupportedException();
    }

    public override void Flush() { }

    public override int Read(byte[] buffer, int offset, int count)
    {
        if (_disposed) throw new ObjectDisposedException(nameof(PtyStream));
        if (!CanRead) throw new NotSupportedException("Stream is not readable");

        byte[] tempBuffer = offset == 0 ? buffer : new byte[count];
        IntPtr bytesRead = read(_fd, tempBuffer, (IntPtr)count);

        if ((long)bytesRead < 0)
        {
            var error = Marshal.GetLastWin32Error();
            if (error == 5) // EIO - terminal closed
                return 0;
            throw new IOException($"Read failed with error {error}");
        }

        if (offset != 0 && (long)bytesRead > 0)
        {
            Array.Copy(tempBuffer, 0, buffer, offset, (int)bytesRead);
        }

        return (int)bytesRead;
    }

    public override void Write(byte[] buffer, int offset, int count)
    {
        if (_disposed) throw new ObjectDisposedException(nameof(PtyStream));
        if (!CanWrite) throw new NotSupportedException("Stream is not writable");

        byte[] tempBuffer = offset == 0 ? buffer : buffer[offset..(offset + count)];
        IntPtr bytesWritten = write(_fd, tempBuffer, (IntPtr)count);

        if ((long)bytesWritten < 0)
        {
            throw new IOException($"Write failed with error {Marshal.GetLastWin32Error()}");
        }
    }

    public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
    public override void SetLength(long value) => throw new NotSupportedException();

    protected override void Dispose(bool disposing)
    {
        if (!_disposed)
        {
            _disposed = true;
            // Don't close the fd here - it's shared between read and write streams
        }
        base.Dispose(disposing);
    }
}

/// <summary>
/// Linux PTY connection using forkpty.
/// </summary>
internal class LinuxPtyConnection : IPtyConnection
{
    private const int EINTR = 4;
    private const int ECHILD = 10;

    private readonly int _controller;
    private readonly int _pid;
    private readonly ManualResetEvent _terminalProcessTerminatedEvent = new(false);
    private int _exitCode;
    private bool _disposed;
    private bool _exited;

    public LinuxPtyConnection(int controller, int pid)
    {
        _controller = controller;
        _pid = pid;

        ReaderStream = new PtyStream(controller, FileAccess.Read);
        WriterStream = new PtyStream(controller, FileAccess.Write);

        var childWatcherThread = new Thread(ChildWatcherThreadProc)
        {
            IsBackground = true,
            Priority = ThreadPriority.Lowest,
            Name = $"PTY watcher for PID {pid}",
        };
        childWatcherThread.Start();
    }

    public event EventHandler<PtyExitedEventArgs>? ProcessExited;

    public Stream ReaderStream { get; }
    public Stream WriterStream { get; }
    public int Pid => _pid;
    public int ExitCode => _exitCode;
    public bool IsAlive => !_exited && !_disposed;

    public bool WaitForExit(int milliseconds)
    {
        return _terminalProcessTerminatedEvent.WaitOne(milliseconds);
    }

    public void Kill()
    {
        if (kill(_pid, SIGHUP) != 0 && Marshal.GetLastWin32Error() != 3) // ESRCH - no such process
        {
            throw new InvalidOperationException($"Kill failed with error {Marshal.GetLastWin32Error()}");
        }
    }

    public void Resize(int cols, int rows)
    {
        var winSize = new WinSize((ushort)rows, (ushort)cols);
        if (ioctl(_controller, TIOCSWINSZ, ref winSize) != 0)
        {
            throw new InvalidOperationException($"Resize failed with error {Marshal.GetLastWin32Error()}");
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        try { Kill(); } catch { }
        close(_controller);
        _terminalProcessTerminatedEvent.Dispose();
    }

    private void ChildWatcherThreadProc()
    {
        const int SignalMask = 127;
        const int ExitCodeMask = 255;

        int status = 0;
        while (true)
        {
            int result = waitpid(_pid, ref status, 0);
            if (result == _pid)
            {
                break;
            }

            int errno = Marshal.GetLastWin32Error();
            if (errno == EINTR)
            {
                continue; // Interrupted, try again
            }
            else if (errno == ECHILD)
            {
                // Child already reaped
                return;
            }
            else
            {
                return;
            }
        }

        int exitSignal = status & SignalMask;
        _exitCode = exitSignal == 0 ? (status >> 8) & ExitCodeMask : 128 + exitSignal;
        _exited = true;
        _terminalProcessTerminatedEvent.Set();
        ProcessExited?.Invoke(this, new PtyExitedEventArgs(_exitCode));
    }
}

/// <summary>
/// Provider for spawning PTY processes on Linux and Windows.
/// </summary>
public static class PtyProvider
{
    /// <summary>
    /// Returns true if PTY is supported on the current platform.
    /// </summary>
    public static bool IsSupported
    {
        get
        {
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
            {
                return true;
            }
            
            if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            {
                return WindowsNativeMethods.IsConPtySupported();
            }
            
            return false;
        }
    }

    /// <summary>
    /// Spawn a new process connected to a pseudoterminal.
    /// </summary>
    public static IPtyConnection Spawn(PtyOptions options)
    {
        if (string.IsNullOrEmpty(options.App))
        {
            throw new ArgumentNullException(nameof(options.App));
        }

        if (string.IsNullOrEmpty(options.Cwd))
        {
            options.Cwd = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        }

        // Merge environment
        var environment = new Dictionary<string, string>();
        foreach (System.Collections.DictionaryEntry entry in Environment.GetEnvironmentVariables())
        {
            if (entry.Key is string key && entry.Value is string value)
            {
                environment[key] = value;
            }
        }
        
        // Add PTY-specific environment
        environment["TERM"] = "xterm-256color";
        environment["COLORTERM"] = "truecolor";
        environment["COLUMNS"] = options.Cols.ToString();
        environment["LINES"] = options.Rows.ToString();
        
        // Merge user-provided environment
        foreach (var kvp in options.Environment)
        {
            environment[kvp.Key] = kvp.Value;
        }

        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            return SpawnWindows(options, environment);
        }
        else if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
        {
            return SpawnLinux(options, environment);
        }
        else
        {
            throw new PlatformNotSupportedException("PTY is only supported on Linux and Windows");
        }
    }

    private static IPtyConnection SpawnWindows(PtyOptions options, Dictionary<string, string> environment)
    {
        var connection = WindowsPtyConnection.Spawn(
            options.App,
            options.CommandLine,
            options.Cwd,
            environment,
            options.Cols,
            options.Rows);

        return new WindowsPtyConnectionWrapper(connection);
    }

    private static IPtyConnection SpawnLinux(PtyOptions options, Dictionary<string, string> environment)
    {
        // Use the safer ProcessPtyConnection that uses the 'script' command
        // instead of native forkpty() which can cause issues with .NET runtime
        return ProcessPtyConnection.Spawn(
            options.App,
            options.CommandLine,
            options.Cwd,
            environment,
            options.Cols,
            options.Rows);
    }
}

/// <summary>
/// Wrapper to adapt WindowsPtyConnection to IPtyConnection interface
/// </summary>
internal class WindowsPtyConnectionWrapper : IPtyConnection
{
    private readonly WindowsPtyConnection _inner;
    private int _exitCode;

    public WindowsPtyConnectionWrapper(WindowsPtyConnection inner)
    {
        _inner = inner;
        
        // Start a thread to watch for process exit
        var watcherThread = new Thread(WatchForExit)
        {
            IsBackground = true,
            Priority = ThreadPriority.Lowest,
            Name = $"PTY watcher for PID {inner.ProcessId}",
        };
        watcherThread.Start();
    }

    public event EventHandler<PtyExitedEventArgs>? ProcessExited;

    public Stream ReaderStream => _inner.ReaderStream;
    public Stream WriterStream => _inner.WriterStream;
    public int Pid => _inner.ProcessId;
    public int ExitCode => _exitCode;
    public bool IsAlive => _inner.IsAlive;

    public bool WaitForExit(int milliseconds) => _inner.WaitForExit(milliseconds);
    public void Kill() => _inner.Kill();
    public void Resize(int cols, int rows) => _inner.Resize(cols, rows);
    public void Dispose() => _inner.Dispose();

    private void WatchForExit()
    {
        _inner.WaitForExit(-1); // Wait indefinitely
        _exitCode = _inner.GetExitCode() ?? -1;
        ProcessExited?.Invoke(this, new PtyExitedEventArgs(_exitCode));
    }
}
