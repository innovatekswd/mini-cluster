// Simple PTY implementation using script command on Linux or direct Process on Windows
// The script command provides a pseudo-terminal wrapper

using System.Diagnostics;

namespace Innovatek.Parallel.MiniCluster.Api.Services.Pty;

/// <summary>
/// PTY implementation using the `script` command on Linux to provide pseudo-terminal.
/// Falls back to direct process for Windows.
/// </summary>
internal sealed class ProcessPtyConnection : IPtyConnection
{
    private readonly Process _process;
    private readonly MergedStream _mergedStream;
    private readonly ManualResetEvent _exitEvent = new(false);
    private int _exitCode;
    private bool _disposed;

    public event EventHandler<PtyExitedEventArgs>? ProcessExited;

    public Stream ReaderStream => _mergedStream;
    public Stream WriterStream { get; }
    public int Pid => _process.Id;
    public int ExitCode => _exitCode;
    public bool IsAlive => !_process.HasExited;

    private ProcessPtyConnection(Process process, MergedStream mergedStream)
    {
        _process = process;
        _mergedStream = mergedStream;
        WriterStream = new FlushOnWriteStream(process.StandardInput.BaseStream);

        _process.EnableRaisingEvents = true;
        _process.Exited += (s, e) =>
        {
            try { _exitCode = _process.ExitCode; } catch { _exitCode = -1; }
            _exitEvent.Set();
            _mergedStream.Complete();
            ProcessExited?.Invoke(this, new PtyExitedEventArgs(_exitCode));
        };
    }

    /// <summary>
    /// Spawn a shell process with PTY support via script command
    /// </summary>
    public static ProcessPtyConnection Spawn(
        string shell,
        string[] args,
        string workingDirectory,
        IDictionary<string, string> environment,
        int cols,
        int rows)
    {
        var startInfo = new ProcessStartInfo
        {
            WorkingDirectory = workingDirectory,
            UseShellExecute = false,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
        };

        // Set environment variables
        foreach (var kvp in environment)
        {
            startInfo.Environment[kvp.Key] = kvp.Value;
        }

        // Set terminal environment
        startInfo.Environment["TERM"] = "xterm-256color";
        startInfo.Environment["COLORTERM"] = "truecolor";
        startInfo.Environment["COLUMNS"] = cols.ToString();
        startInfo.Environment["LINES"] = rows.ToString();

        // Use script command on Linux to provide PTY, or direct process on Windows
        if (OperatingSystem.IsLinux() || OperatingSystem.IsMacOS())
        {
            // script command creates a PTY and runs the shell
            // -q = quiet (no start/done messages)
            // -c = command to run
            // /dev/null = don't save typescript file (but still outputs to stdout)
            startInfo.FileName = "/usr/bin/script";
            startInfo.ArgumentList.Add("-q");
            startInfo.ArgumentList.Add("/dev/null");
            startInfo.ArgumentList.Add("-c");
            
            // Build the shell command - force prompt output
            var shellCmd = $"TERM=xterm-256color PS1='$ ' {shell}";
            if (args.Length > 0)
            {
                shellCmd += " " + string.Join(" ", args);
            }
            startInfo.ArgumentList.Add(shellCmd);
        }
        else
        {
            startInfo.FileName = shell;
            foreach (var arg in args)
            {
                startInfo.ArgumentList.Add(arg);
            }
        }

        var process = new Process { StartInfo = startInfo };
        
        if (!process.Start())
        {
            throw new InvalidOperationException("Failed to start shell process");
        }

        // Create merged stream that combines stdout and stderr
        var mergedStream = new MergedStream();

        // Read stdout
        _ = Task.Run(async () =>
        {
            try
            {
                var buffer = new byte[4096];
                while (true)
                {
                    var bytesRead = await process.StandardOutput.BaseStream.ReadAsync(buffer);
                    if (bytesRead == 0) break;
                    mergedStream.Write(buffer, 0, bytesRead);
                }
            }
            catch { }
        });

        // Read stderr
        _ = Task.Run(async () =>
        {
            try
            {
                var buffer = new byte[4096];
                while (true)
                {
                    var bytesRead = await process.StandardError.BaseStream.ReadAsync(buffer);
                    if (bytesRead == 0) break;
                    mergedStream.Write(buffer, 0, bytesRead);
                }
            }
            catch { }
        });

        return new ProcessPtyConnection(process, mergedStream);
    }

    public void Resize(int cols, int rows)
    {
        // TODO: Could potentially use stty to resize
    }

    public void Kill()
    {
        try
        {
            if (!_process.HasExited)
            {
                _process.Kill(entireProcessTree: true);
            }
        }
        catch { }
    }

    public bool WaitForExit(int milliseconds)
    {
        return _exitEvent.WaitOne(milliseconds);
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        try { Kill(); } catch { }
        try { WriterStream.Dispose(); } catch { }
        try { _mergedStream.Dispose(); } catch { }
        try { _process.Dispose(); } catch { }
        try { _exitEvent.Dispose(); } catch { }
    }
}

/// <summary>
/// A stream that auto-flushes on every write to ensure data is sent immediately
/// </summary>
internal class FlushOnWriteStream : Stream
{
    private readonly Stream _inner;
    
    public FlushOnWriteStream(Stream inner) => _inner = inner;
    
    public override bool CanRead => false;
    public override bool CanSeek => false;
    public override bool CanWrite => _inner.CanWrite;
    public override long Length => throw new NotSupportedException();
    public override long Position 
    { 
        get => throw new NotSupportedException(); 
        set => throw new NotSupportedException(); 
    }

    public override void Write(byte[] buffer, int offset, int count)
    {
        _inner.Write(buffer, offset, count);
        _inner.Flush();
    }

    public override async Task WriteAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
    {
        await _inner.WriteAsync(buffer.AsMemory(offset, count), cancellationToken);
        await _inner.FlushAsync(cancellationToken);
    }

    public override async ValueTask WriteAsync(ReadOnlyMemory<byte> buffer, CancellationToken cancellationToken = default)
    {
        await _inner.WriteAsync(buffer, cancellationToken);
        await _inner.FlushAsync(cancellationToken);
    }

    public override void Flush() => _inner.Flush();
    public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
    public override void SetLength(long value) => throw new NotSupportedException();
    
    protected override void Dispose(bool disposing)
    {
        if (disposing) _inner.Dispose();
        base.Dispose(disposing);
    }
}

/// <summary>
/// A thread-safe stream that merges data from multiple writers into a single readable stream
/// </summary>
internal class MergedStream : Stream
{
    private readonly Queue<byte[]> _queue = new();
    private readonly object _lock = new();
    private readonly ManualResetEventSlim _dataAvailable = new(false);
    private byte[]? _currentBuffer;
    private int _currentOffset;
    private bool _completed;
    private bool _disposed;

    public override bool CanRead => true;
    public override bool CanSeek => false;
    public override bool CanWrite => true;
    public override long Length => throw new NotSupportedException();
    public override long Position 
    { 
        get => throw new NotSupportedException(); 
        set => throw new NotSupportedException(); 
    }

    public override void Write(byte[] buffer, int offset, int count)
    {
        if (_disposed || _completed) return;
        
        var copy = new byte[count];
        Array.Copy(buffer, offset, copy, 0, count);
        
        lock (_lock)
        {
            _queue.Enqueue(copy);
            _dataAvailable.Set();
        }
    }

    public override int Read(byte[] buffer, int offset, int count)
    {
        if (_disposed) return 0;

        while (true)
        {
            // Try to read from current buffer
            if (_currentBuffer != null)
            {
                var available = _currentBuffer.Length - _currentOffset;
                var toRead = Math.Min(available, count);
                Array.Copy(_currentBuffer, _currentOffset, buffer, offset, toRead);
                _currentOffset += toRead;
                
                if (_currentOffset >= _currentBuffer.Length)
                {
                    _currentBuffer = null;
                    _currentOffset = 0;
                }
                
                return toRead;
            }

            // Try to get next buffer from queue
            lock (_lock)
            {
                if (_queue.Count > 0)
                {
                    _currentBuffer = _queue.Dequeue();
                    _currentOffset = 0;
                    continue;
                }
                
                if (_completed) return 0;
                
                _dataAvailable.Reset();
            }

            // Wait for more data
            if (!_dataAvailable.Wait(100))
            {
                if (_completed) return 0;
            }
        }
    }

    public void Complete()
    {
        _completed = true;
        _dataAvailable.Set();
    }

    public override void Flush() { }
    public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
    public override void SetLength(long value) => throw new NotSupportedException();

    protected override void Dispose(bool disposing)
    {
        if (_disposed) return;
        _disposed = true;
        
        if (disposing)
        {
            _completed = true;
            _dataAvailable.Set();
            _dataAvailable.Dispose();
        }
        
        base.Dispose(disposing);
    }
}
