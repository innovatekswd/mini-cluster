// Based on Microsoft's vs-pty.net (MIT License)
// https://github.com/microsoft/vs-pty.net

using System.Runtime.InteropServices;
using System.Text;

namespace Innovatek.Parallel.MiniCluster.Api.Services.Pty;

internal static class PtyNativeMethods
{
    internal const int STDIN_FILENO = 0;
    internal const uint TIOCSIG = 0x4004_5436;
    internal const ulong TIOCSWINSZ = 0x5414;
    internal const int SIGHUP = 1;

    private const string LibC = "libc.so.6";
    private const string LibUtil = "libutil.so.1";

    public enum TermSpeed : uint
    {
        B38400 = 0x0F,
    }

    [Flags]
    public enum TermInputFlag : uint
    {
        BRKINT = 0x2,
        ICRNL = 0x100,
        IXON = 0x400,
        IXANY = 0x800,
        IMAXBEL = 0x2000,
        IUTF8 = 0x4000,
    }

    [Flags]
    public enum TermOutputFlag : uint
    {
        OPOST = 1,
        ONLCR = 4,
    }

    [Flags]
    public enum TermControlFlag : uint
    {
        CS8 = 0x30,
        CREAD = 0x80,
        HUPCL = 0x400,
    }

    [Flags]
    public enum TermLocalFlag : uint
    {
        ECHOKE = 0x800,
        ECHOE = 0x10,
        ECHOK = 0x20,
        ECHO = 0x8,
        ECHOCTL = 0x200,
        ISIG = 0x1,
        ICANON = 0x2,
        IEXTEN = 0x8000,
    }

    public enum TermSpecialControlCharacter
    {
        VEOF = 4,
        VEOL = 11,
        VEOL2 = 16,
        VERASE = 2,
        VWERASE = 14,
        VKILL = 3,
        VREPRINT = 12,
        VINTR = 0,
        VQUIT = 1,
        VSUSP = 10,
        VSTART = 8,
        VSTOP = 9,
        VLNEXT = 15,
        VDISCARD = 13,
        VMIN = 6,
        VTIME = 5,
    }

    [DllImport(LibC)]
    internal static extern int cfsetispeed(ref Termios termios, IntPtr speed);

    [DllImport(LibC)]
    internal static extern int cfsetospeed(ref Termios termios, IntPtr speed);

    [DllImport(LibUtil, SetLastError = true)]
    internal static extern int forkpty(ref int master, StringBuilder? name, ref Termios termp, ref WinSize winsize);

    [DllImport(LibC, SetLastError = true)]
    internal static extern int waitpid(int pid, ref int status, int options);

    [DllImport(LibC, SetLastError = true)]
    internal static extern int ioctl(int fd, ulong request, int data);

    [DllImport(LibC, SetLastError = true)]
    internal static extern int ioctl(int fd, ulong request, ref WinSize winSize);

    [DllImport(LibC, SetLastError = true)]
    internal static extern int kill(int pid, int signal);

    [DllImport(LibC, SetLastError = true)]
    internal static extern int close(int fd);

    [DllImport(LibC, SetLastError = true)]
    internal static extern IntPtr read(int fd, byte[] buf, IntPtr count);

    [DllImport(LibC, SetLastError = true)]
    internal static extern IntPtr write(int fd, byte[] buf, IntPtr count);

    [DllImport(LibC, SetLastError = true)]
    private static extern int setenv(string name, string value, int overwrite);

    [DllImport(LibC, SetLastError = true)]
    private static extern int execvp(
        [MarshalAs(UnmanagedType.LPStr)] string file,
        [MarshalAs(UnmanagedType.LPArray, ArraySubType = UnmanagedType.LPStr)] string?[] args);

    internal static void execvpe(string file, string?[] args, IDictionary<string, string> environment)
    {
        // Set environment
        foreach (var environmentVariable in environment)
        {
            setenv(environmentVariable.Key, environmentVariable.Value, 1);
        }

        if (execvp(file, args) == -1)
        {
            Environment.Exit(Marshal.GetLastWin32Error());
        }
        else
        {
            // Unreachable
            Environment.Exit(-1);
        }
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct WinSize
    {
        public ushort Rows;
        public ushort Cols;
        public ushort XPixel;
        public ushort YPixel;

        public WinSize(ushort rows, ushort cols)
        {
            Rows = rows;
            Cols = cols;
            XPixel = 0;
            YPixel = 0;
        }
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct Termios
    {
        public const int NCCS = 32;

        public uint IFlag;
        public uint OFlag;
        public uint CFlag;
        public uint LFlag;

        public sbyte line;

        [MarshalAs(UnmanagedType.ByValArray, SizeConst = NCCS)]
        public sbyte[] CC;
        public uint ISpeed;
        public uint OSpeed;

        public Termios(
            TermInputFlag inputFlag,
            TermOutputFlag outputFlag,
            TermControlFlag controlFlag,
            TermLocalFlag localFlag,
            TermSpeed speed,
            IDictionary<TermSpecialControlCharacter, sbyte> controlCharacters)
        {
            IFlag = (uint)inputFlag;
            OFlag = (uint)outputFlag;
            CFlag = (uint)controlFlag;
            LFlag = (uint)localFlag;
            CC = new sbyte[NCCS];
            foreach (var kvp in controlCharacters)
            {
                CC[(int)kvp.Key] = kvp.Value;
            }

            line = 0;
            ISpeed = 0;
            OSpeed = 0;
            cfsetispeed(ref this, (IntPtr)speed);
            cfsetospeed(ref this, (IntPtr)speed);
        }

        public static Termios CreateDefault()
        {
            var controlCharacters = new Dictionary<TermSpecialControlCharacter, sbyte>
            {
                { TermSpecialControlCharacter.VEOF, 4 },
                { TermSpecialControlCharacter.VEOL, -1 },
                { TermSpecialControlCharacter.VEOL2, -1 },
                { TermSpecialControlCharacter.VERASE, 0x7f },
                { TermSpecialControlCharacter.VWERASE, 23 },
                { TermSpecialControlCharacter.VKILL, 21 },
                { TermSpecialControlCharacter.VREPRINT, 18 },
                { TermSpecialControlCharacter.VINTR, 3 },
                { TermSpecialControlCharacter.VQUIT, 0x1c },
                { TermSpecialControlCharacter.VSUSP, 26 },
                { TermSpecialControlCharacter.VSTART, 17 },
                { TermSpecialControlCharacter.VSTOP, 19 },
                { TermSpecialControlCharacter.VLNEXT, 22 },
                { TermSpecialControlCharacter.VDISCARD, 15 },
                { TermSpecialControlCharacter.VMIN, 1 },
                { TermSpecialControlCharacter.VTIME, 0 },
            };

            return new Termios(
                inputFlag: TermInputFlag.ICRNL | TermInputFlag.IXON | TermInputFlag.IXANY | TermInputFlag.IMAXBEL | TermInputFlag.BRKINT | TermInputFlag.IUTF8,
                outputFlag: TermOutputFlag.OPOST | TermOutputFlag.ONLCR,
                controlFlag: TermControlFlag.CREAD | TermControlFlag.CS8 | TermControlFlag.HUPCL,
                localFlag: TermLocalFlag.ICANON | TermLocalFlag.ISIG | TermLocalFlag.IEXTEN | TermLocalFlag.ECHO | TermLocalFlag.ECHOE | TermLocalFlag.ECHOK | TermLocalFlag.ECHOKE | TermLocalFlag.ECHOCTL,
                speed: TermSpeed.B38400,
                controlCharacters: controlCharacters);
        }
    }
}
