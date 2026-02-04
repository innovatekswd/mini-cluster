// Based on Microsoft's vs-pty.net (MIT License)
// Windows ConPTY implementation

using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

namespace Innovatek.Parallel.MiniCluster.Api.Services.Pty;

internal static class WindowsNativeMethods
{
    internal const uint PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE = 0x00020016;
    internal const uint EXTENDED_STARTUPINFO_PRESENT = 0x00080000;
    internal const uint CREATE_UNICODE_ENVIRONMENT = 0x00000400;
    internal const int STARTF_USESTDHANDLES = 0x00000100;
    internal const int S_OK = 0;
    internal static readonly IntPtr INVALID_HANDLE_VALUE = new IntPtr(-1);

    [DllImport("kernel32.dll", SetLastError = true)]
    internal static extern int CreatePseudoConsole(
        Coord size,
        SafeFileHandle hInput,
        SafeFileHandle hOutput,
        uint dwFlags,
        out IntPtr phPC);

    [DllImport("kernel32.dll", SetLastError = true)]
    internal static extern int ResizePseudoConsole(IntPtr hPC, Coord size);

    [DllImport("kernel32.dll", SetLastError = true)]
    internal static extern void ClosePseudoConsole(IntPtr hPC);

    [DllImport("kernel32.dll", SetLastError = true)]
    internal static extern bool CreatePipe(
        out SafeFileHandle hReadPipe,
        out SafeFileHandle hWritePipe,
        IntPtr lpPipeAttributes,
        int nSize);

    [DllImport("kernel32.dll", SetLastError = true)]
    internal static extern bool InitializeProcThreadAttributeList(
        IntPtr lpAttributeList,
        int dwAttributeCount,
        int dwFlags,
        ref IntPtr lpSize);

    [DllImport("kernel32.dll", SetLastError = true)]
    internal static extern bool UpdateProcThreadAttribute(
        IntPtr lpAttributeList,
        uint dwFlags,
        IntPtr Attribute,
        IntPtr lpValue,
        IntPtr cbSize,
        IntPtr lpPreviousValue,
        IntPtr lpReturnSize);

    [DllImport("kernel32.dll", SetLastError = true)]
    internal static extern void DeleteProcThreadAttributeList(IntPtr lpAttributeList);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    internal static extern bool CreateProcess(
        string? lpApplicationName,
        string lpCommandLine,
        IntPtr lpProcessAttributes,
        IntPtr lpThreadAttributes,
        bool bInheritHandles,
        uint dwCreationFlags,
        IntPtr lpEnvironment,
        string? lpCurrentDirectory,
        ref STARTUPINFOEX lpStartupInfo,
        out PROCESS_INFORMATION lpProcessInformation);

    [DllImport("kernel32.dll", SetLastError = true)]
    internal static extern bool GetExitCodeProcess(SafeProcessHandle hProcess, out int lpExitCode);

    [DllImport("kernel32.dll", SetLastError = true)]
    internal static extern uint WaitForSingleObject(SafeProcessHandle hHandle, uint dwMilliseconds);

    [DllImport("kernel32.dll", SetLastError = true)]
    internal static extern bool TerminateProcess(SafeProcessHandle hProcess, uint uExitCode);

    [DllImport("kernel32.dll")]
    internal static extern bool CloseHandle(IntPtr hObject);

    [DllImport("kernel32.dll", SetLastError = true)]
    internal static extern IntPtr GetStdHandle(int nStdHandle);

    internal const uint WAIT_OBJECT_0 = 0x00000000;
    internal const uint WAIT_TIMEOUT = 0x00000102;
    internal const uint INFINITE = 0xFFFFFFFF;
    internal const int STILL_ACTIVE = 259;

    [StructLayout(LayoutKind.Sequential)]
    internal struct Coord
    {
        public short X;
        public short Y;

        public Coord(int x, int y)
        {
            X = (short)x;
            Y = (short)y;
        }
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    internal struct STARTUPINFOEX
    {
        public STARTUPINFO StartupInfo;
        public IntPtr lpAttributeList;

        public void InitAttributeList(int attributeCount)
        {
            IntPtr size = IntPtr.Zero;
            InitializeProcThreadAttributeList(IntPtr.Zero, attributeCount, 0, ref size);
            lpAttributeList = Marshal.AllocHGlobal(size);
            if (!InitializeProcThreadAttributeList(lpAttributeList, attributeCount, 0, ref size))
            {
                Marshal.FreeHGlobal(lpAttributeList);
                lpAttributeList = IntPtr.Zero;
                throw new InvalidOperationException($"InitializeProcThreadAttributeList failed: {Marshal.GetLastWin32Error()}");
            }
        }

        public void SetPseudoConsole(IntPtr hPC)
        {
            if (!UpdateProcThreadAttribute(
                lpAttributeList,
                0,
                (IntPtr)PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE,
                hPC,
                (IntPtr)IntPtr.Size,
                IntPtr.Zero,
                IntPtr.Zero))
            {
                throw new InvalidOperationException($"UpdateProcThreadAttribute failed: {Marshal.GetLastWin32Error()}");
            }
        }

        public void Free()
        {
            if (lpAttributeList != IntPtr.Zero)
            {
                DeleteProcThreadAttributeList(lpAttributeList);
                Marshal.FreeHGlobal(lpAttributeList);
                lpAttributeList = IntPtr.Zero;
            }
        }
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    internal struct STARTUPINFO
    {
        public int cb;
        public string lpReserved;
        public string lpDesktop;
        public string lpTitle;
        public int dwX;
        public int dwY;
        public int dwXSize;
        public int dwYSize;
        public int dwXCountChars;
        public int dwYCountChars;
        public int dwFillAttribute;
        public int dwFlags;
        public short wShowWindow;
        public short cbReserved2;
        public IntPtr lpReserved2;
        public IntPtr hStdInput;
        public IntPtr hStdOutput;
        public IntPtr hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    internal struct PROCESS_INFORMATION
    {
        public IntPtr hProcess;
        public IntPtr hThread;
        public int dwProcessId;
        public int dwThreadId;
    }

    /// <summary>
    /// Check if ConPTY is supported (Windows 10 1809+)
    /// </summary>
    internal static bool IsConPtySupported()
    {
        try
        {
            // Try to create a pseudo console - if it fails with specific error, not supported
            var size = new Coord(80, 25);
            if (!CreatePipe(out var inputReadSide, out var inputWriteSide, IntPtr.Zero, 0))
                return false;
            if (!CreatePipe(out var outputReadSide, out var outputWriteSide, IntPtr.Zero, 0))
            {
                inputReadSide.Dispose();
                inputWriteSide.Dispose();
                return false;
            }

            int hr = CreatePseudoConsole(size, inputReadSide, outputWriteSide, 0, out var hPC);
            
            inputReadSide.Dispose();
            inputWriteSide.Dispose();
            outputReadSide.Dispose();
            outputWriteSide.Dispose();

            if (hr == S_OK && hPC != IntPtr.Zero)
            {
                ClosePseudoConsole(hPC);
                return true;
            }

            return false;
        }
        catch
        {
            return false;
        }
    }
}

/// <summary>
/// Safe handle wrapper for pseudo console handle
/// </summary>
internal class SafePseudoConsoleHandle : SafeHandleZeroOrMinusOneIsInvalid
{
    public SafePseudoConsoleHandle() : base(true) { }

    public void InitialSetHandle(IntPtr h)
    {
        SetHandle(h);
    }

    protected override bool ReleaseHandle()
    {
        WindowsNativeMethods.ClosePseudoConsole(handle);
        return true;
    }
}
