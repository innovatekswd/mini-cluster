using System.ComponentModel.DataAnnotations;

namespace Innovatek.Parallel.MiniCluster.Api.Models.Explorer;

/// <summary>
/// Supported archive formats for compression
/// </summary>
public static class ArchiveFormats
{
    public const string Zip = "zip";
    public const string TarGz = "tar.gz";
    public const string Tar = "tar";
    public const string TarBz2 = "tar.bz2";
    public const string SevenZip = "7z";
    public const string GZip = "gz";

    /// <summary>
    /// Formats that can be created
    /// </summary>
    public static readonly string[] WritableFormats = [Zip, TarGz, Tar, TarBz2, SevenZip, GZip];

    /// <summary>
    /// All file extensions recognized as archives (for extraction)
    /// </summary>
    public static readonly string[] ArchiveExtensions =
    [
        ".zip", ".tar", ".tar.gz", ".tgz", ".tar.bz2", ".tbz2", ".tar.xz", ".txz",
        ".7z", ".rar", ".gz", ".bz2", ".xz", ".lz", ".lzma"
    ];

    /// <summary>
    /// Check if a file path is a recognized archive
    /// </summary>
    public static bool IsArchive(string path)
    {
        var lower = path.ToLowerInvariant();
        foreach (var ext in ArchiveExtensions)
        {
            if (lower.EndsWith(ext))
                return true;
        }
        return false;
    }

    /// <summary>
    /// Get human-readable format name
    /// </summary>
    public static string GetFormatDisplayName(string format)
    {
        return format switch
        {
            Zip => "ZIP",
            TarGz => "TAR.GZ",
            Tar => "TAR",
            TarBz2 => "TAR.BZ2",
            SevenZip => "7-Zip",
            GZip => "GZip",
            _ => format.ToUpperInvariant()
        };
    }
}

/// <summary>
/// Request to compress files/directories into an archive
/// </summary>
public class CompressRequest
{
    /// <summary>
    /// Paths of files and/or directories to compress
    /// </summary>
    [Required]
    [MinLength(1, ErrorMessage = "At least one path is required")]
    public List<string> Paths { get; set; } = new();

    /// <summary>
    /// Full path for the output archive file
    /// </summary>
    [Required]
    public string OutputPath { get; set; } = string.Empty;

    /// <summary>
    /// Archive format: zip, tar.gz, tar, tar.bz2, 7z, gz
    /// </summary>
    [Required]
    public string Format { get; set; } = "zip";
}

/// <summary>
/// Request to extract an archive
/// </summary>
public class ExtractRequest
{
    /// <summary>
    /// Path to the archive file to extract
    /// </summary>
    [Required]
    public string ArchivePath { get; set; } = string.Empty;

    /// <summary>
    /// Directory to extract files into
    /// </summary>
    [Required]
    public string DestinationPath { get; set; } = string.Empty;

    /// <summary>
    /// Whether to overwrite existing files
    /// </summary>
    public bool Overwrite { get; set; } = false;
}

/// <summary>
/// Result of a compress or extract operation
/// </summary>
public class ArchiveOperationResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Output path (archive file for compress, directory for extract)
    /// </summary>
    public string OutputPath { get; set; } = string.Empty;

    /// <summary>
    /// Number of entries/files processed
    /// </summary>
    public int EntryCount { get; set; }

    /// <summary>
    /// Total size in bytes of the result
    /// </summary>
    public long TotalSize { get; set; }

    /// <summary>
    /// Original total size before compression (for compress operations)
    /// </summary>
    public long OriginalSize { get; set; }
}

/// <summary>
/// An entry within an archive (for listing contents)
/// </summary>
public class ArchiveEntry
{
    public string Name { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public long Size { get; set; }
    public long CompressedSize { get; set; }
    public DateTime? LastModified { get; set; }
    public bool IsDirectory { get; set; }
}

/// <summary>
/// Response for listing archive contents
/// </summary>
public class ArchiveContentsResponse
{
    public string ArchivePath { get; set; } = string.Empty;
    public string Format { get; set; } = string.Empty;
    public List<ArchiveEntry> Entries { get; set; } = new();
    public int TotalEntries { get; set; }
    public long TotalSize { get; set; }
    public long CompressedSize { get; set; }
}
