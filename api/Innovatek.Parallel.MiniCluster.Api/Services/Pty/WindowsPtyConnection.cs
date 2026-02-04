// Based on Microsoft's vs-pty.net (MIT License)
// Windows ConPTY Connection implementation

using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
using static Innovatek.Parallel.MiniCluster.Api.Services.Pty.WindowsNativeMethods;

namespace Innovatek.Parallel.MiniCluster.Api.Services.Pty;

/// <summary>
/// Windows ConPTY connection using the Pseudo Console API
/// Available on Windows 10 version 1809 and later
/// </summary>
internal sealed class WindowsPtyConnection : IDisposable
{
    private readonly IntPtr _hPC;
    private readonly SafeProcessHandle _processHandle;
    private readonly SafeFileHandle _inputWriteSide;
    private readonly SafeFileHandle _outputReadSide;
    private readonly Stream _readerStream;
    private readonly Stream _writerStream;
    private readonly int _processId;
    private bool _disposed;

    public Stream ReaderStream => _readerStream;
    public Stream WriterStream => _writerStream;
    public int ProcessId => _processId;
    public bool IsAlive => !HasExited();

    private WindowsPtyConnection(
        IntPtr hPC,
        SafeProcessHandle processHandle,
        SafeFileHandle inputWriteSide,
        SafeFileHandle outputReadSide,
        int processId)
    {
        _hPC = hPC;
        _processHandle = processHandle;
        _inputWriteSide = inputWriteSide;
        _outputReadSide = outputReadSide;
        _processId = processId;

        _readerStream = new FileStream(_outputReadSide, FileAccess.Read, 4096, isAsync: false);
        _writerStream = new FileStream(_inputWriteSide, FileAccess.Write, 4096, isAsync: false);
    }

    /// <summary>
    /// Spawn a new process with ConPTY
    /// </summary>
    public static WindowsPtyConnection Spawn(
        string command,
        string[]? args,
        string workingDirectory,
        IDictionary<string, string>? environment,
        int cols,
        int rows)
    {
        // Create pipes for ConPTY
        if (!CreatePipe(out var inputReadSide, out var inputWriteSide, IntPtr.Zero, 0))
        {
            throw new InvalidOperationException($"Failed to create input pipe: {Marshal.GetLastWin32Error()}");
        }

        if (!CreatePipe(out var outputReadSide, out var outputWriteSide, IntPtr.Zero, 0))
        {
            inputReadSide.Dispose();
            inputWriteSide.Dispose();
            throw new InvalidOperationException($"Failed to create output pipe: {Marshal.GetLastWin32Error()}");
        }

        // Create the pseudo console
        var size = new Coord(cols, rows);
        int hr = CreatePseudoConsole(size, inputReadSide, outputWriteSide, 0, out var hPC);
        
        if (hr != S_OK)
        {
            inputReadSide.Dispose();
            inputWriteSide.Dispose();
            outputReadSide.Dispose();
            outputWriteSide.Dispose();
            throw new InvalidOperationException($"Failed to create pseudo console: HRESULT 0x{hr:X8}");
        }

        // These pipe ends are now owned by the pseudo console
        inputReadSide.Dispose();
        outputWriteSide.Dispose();

        try
        {
            // Build command line
            string commandLine = args?.Length > 0
                ? $"\"{command}\" {string.Join(" ", args.Select(QuoteArg))}"
                : $"\"{command}\"";

            // Create process with ConPTY
            var startupInfo = new STARTUPINFOEX();
            startupInfo.StartupInfo.cb = Marshal.SizeOf<STARTUPINFOEX>();
            startupInfo.InitAttributeList(1);
            startupInfo.SetPseudoConsole(hPC);

            // Build environment block
            IntPtr envBlock = IntPtr.Zero;
            if (environment != null && environment.Count > 0)
            {
                envBlock = CreateEnvironmentBlock(environment);
            }

            try
            {
                if (!CreateProcess(
                    null,
                    commandLine,
                    IntPtr.Zero,
                    IntPtr.Zero,
                    false,
                    EXTENDED_STARTUPINFO_PRESENT | CREATE_UNICODE_ENVIRONMENT,
                    envBlock,
                    workingDirectory,
                    ref startupInfo,
                    out var processInfo))
                {
                    throw new InvalidOperationException($"Failed to create process: {Marshal.GetLastWin32Error()}");
                }

                // Close thread handle, keep process handle
                CloseHandle(processInfo.hThread);

                var processHandle = new SafeProcessHandle(processInfo.hProcess, true);

                return new WindowsPtyConnection(
                    hPC,
                    processHandle,
                    inputWriteSide,
                    outputReadSide,
                    processInfo.dwProcessId);
            }
            finally
            {
                startupInfo.Free();
                if (envBlock != IntPtr.Zero)
                {
                    Marshal.FreeHGlobal(envBlock);
                }
            }
        }
        catch
        {
            ClosePseudoConsole(hPC);
            inputWriteSide.Dispose();
            outputReadSide.Dispose();
            throw;
        }
    }

    public void Resize(int cols, int rows)
    {
        if (_disposed) return;
        
        var size = new Coord(cols, rows);
        ResizePseudoConsole(_hPC, size);
    }

    public void Kill()
    {
        if (_disposed) return;
        
        try
        {
            if (!HasExited())
            {
                TerminateProcess(_processHandle, 1);
            }
        }
        catch { }
    }

    public bool WaitForExit(int timeoutMs)
    {
        if (_disposed) return true;
        
        uint result = WaitForSingleObject(_processHandle, (uint)timeoutMs);
        return result == WAIT_OBJECT_0;
    }

    public int? GetExitCode()
    {
        if (_disposed) return null;
        
        if (GetExitCodeProcess(_processHandle, out int exitCode))
        {
            return exitCode == STILL_ACTIVE ? null : exitCode;
        }
        return null;
    }

    private bool HasExited()
    {
        if (_processHandle.IsClosed || _processHandle.IsInvalid)
            return true;

        uint result = WaitForSingleObject(_processHandle, 0);
        return result == WAIT_OBJECT_0;
    }

    private static string QuoteArg(string arg)
    {
        if (arg.Contains(' ') || arg.Contains('"'))
        {
            return "\"" + arg.Replace("\"", "\\\"") + "\"";
        }
        return arg;
    }

    private static IntPtr CreateEnvironmentBlock(IDictionary<string, string> environment)
    {
        // Environment block is null-terminated strings, double-null at end
        var entries = environment.Select(kv => $"{kv.Key}={kv.Value}").ToList();
        var block = string.Join('\0', entries) + "\0\0";
        var bytes = System.Text.Encoding.Unicode.GetBytes(block);
        var ptr = Marshal.AllocHGlobal(bytes.Length);
        Marshal.Copy(bytes, 0, ptr, bytes.Length);
        return ptr;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        try { _writerStream.Dispose(); } catch { }
        try { _readerStream.Dispose(); } catch { }
        try { _inputWriteSide.Dispose(); } catch { }
        try { _outputReadSide.Dispose(); } catch { }
        try { ClosePseudoConsole(_hPC); } catch { }
        try { _processHandle.Dispose(); } catch { }
    }
}
