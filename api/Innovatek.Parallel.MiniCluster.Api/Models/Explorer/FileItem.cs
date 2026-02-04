namespace Innovatek.Parallel.MiniCluster.Api.Models.Explorer;

/// <summary>
/// Represents a file or directory item in the explorer
/// </summary>
public class FileItem
{
    /// <summary>
    /// Name of the file or directory
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Full path to the item
    /// </summary>
    public string Path { get; set; } = string.Empty;

    /// <summary>
    /// Type: "file" or "directory"
    /// </summary>
    public string Type { get; set; } = "file";

    /// <summary>
    /// File size in bytes (0 for directories)
    /// </summary>
    public long Size { get; set; }

    /// <summary>
    /// Last modified date/time
    /// </summary>
    public DateTime Modified { get; set; }

    /// <summary>
    /// Creation date/time
    /// </summary>
    public DateTime Created { get; set; }

    /// <summary>
    /// File extension (empty for directories)
    /// </summary>
    public string Extension { get; set; } = string.Empty;

    /// <summary>
    /// MIME type of the file
    /// </summary>
    public string MimeType { get; set; } = "application/octet-stream";

    /// <summary>
    /// Unix-style permissions string (e.g., "rwxr-xr-x")
    /// </summary>
    public string Permissions { get; set; } = string.Empty;

    /// <summary>
    /// Whether the file is hidden
    /// </summary>
    public bool IsHidden { get; set; }

    /// <summary>
    /// Whether the current user can read this item
    /// </summary>
    public bool IsReadable { get; set; } = true;

    /// <summary>
    /// Whether the current user can write to this item
    /// </summary>
    public bool IsWritable { get; set; } = true;

    /// <summary>
    /// Number of items inside (for directories only)
    /// </summary>
    public int? ItemCount { get; set; }

    /// <summary>
    /// Category for UI display (text, image, video, audio, binary)
    /// </summary>
    public string Category { get; set; } = "binary";
}

/// <summary>
/// Response for directory listing
/// </summary>
public class DirectoryListing
{
    /// <summary>
    /// Current path being listed
    /// </summary>
    public string Path { get; set; } = string.Empty;

    /// <summary>
    /// Parent directory path (null if at root)
    /// </summary>
    public string? Parent { get; set; }

    /// <summary>
    /// List of items in the directory
    /// </summary>
    public List<FileItem> Items { get; set; } = new();

    /// <summary>
    /// Total number of items (before pagination)
    /// </summary>
    public int TotalItems { get; set; }

    /// <summary>
    /// Whether there are more items (pagination)
    /// </summary>
    public bool HasMore { get; set; }
}

/// <summary>
/// Detailed file information
/// </summary>
public class FileInfo
{
    public string Name { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public long Size { get; set; }
    public DateTime Modified { get; set; }
    public DateTime Created { get; set; }
    public string Permissions { get; set; } = string.Empty;
    public string Owner { get; set; } = string.Empty;
    public string Group { get; set; } = string.Empty;
    public string MimeType { get; set; } = string.Empty;
    public string Encoding { get; set; } = "utf-8";
    public bool IsReadable { get; set; }
    public bool IsWritable { get; set; }
    public bool IsExecutable { get; set; }
    public bool IsSymlink { get; set; }
    public string? SymlinkTarget { get; set; }
    public string Category { get; set; } = "binary";
}
