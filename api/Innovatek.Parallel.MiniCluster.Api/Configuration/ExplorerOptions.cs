namespace Innovatek.Parallel.MiniCluster.Api.Configuration;

/// <summary>
/// Configuration options for the File Explorer feature
/// </summary>
public class ExplorerOptions
{
    public const string SectionName = "Explorer";

    /// <summary>
    /// List of allowed root paths that can be browsed
    /// </summary>
    public List<string> AllowedPaths { get; set; } = new();

    /// <summary>
    /// List of paths that are explicitly blocked (even if under allowed paths)
    /// </summary>
    public List<string> BlockedPaths { get; set; } = new();

    /// <summary>
    /// Maximum file size for uploads in MB
    /// </summary>
    public int MaxUploadSizeMB { get; set; } = 100;

    /// <summary>
    /// Maximum file size that can be edited in the browser in MB
    /// </summary>
    public int MaxEditFileSizeMB { get; set; } = 10;

    /// <summary>
    /// Whether terminal integration is enabled
    /// </summary>
    public bool EnableTerminal { get; set; } = true;

    /// <summary>
    /// Whether to show hidden files (starting with .)
    /// </summary>
    public bool ShowHiddenFiles { get; set; } = false;

    /// <summary>
    /// Maximum number of items to return in a single directory listing
    /// </summary>
    public int MaxItemsPerPage { get; set; } = 500;

    /// <summary>
    /// File extensions that are allowed for editing
    /// </summary>
    public List<string> EditableExtensions { get; set; } = new()
    {
        ".txt", ".md", ".json", ".xml", ".yaml", ".yml", ".ini", ".conf", ".config",
        ".css", ".scss", ".less", ".html", ".htm", ".js", ".ts", ".jsx", ".tsx",
        ".cs", ".csproj", ".sln", ".py", ".rb", ".php", ".java", ".go", ".rs",
        ".sh", ".bash", ".zsh", ".ps1", ".bat", ".cmd", ".sql", ".graphql",
        ".env", ".gitignore", ".dockerignore", ".editorconfig", ".log", ".svg"
    };

    /// <summary>
    /// Image extensions for preview
    /// </summary>
    public List<string> ImageExtensions { get; set; } = new()
    {
        ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".ico", ".svg"
    };

    /// <summary>
    /// Video extensions for preview
    /// </summary>
    public List<string> VideoExtensions { get; set; } = new()
    {
        ".mp4", ".webm", ".mov", ".avi", ".mkv"
    };

    /// <summary>
    /// Audio extensions for preview
    /// </summary>
    public List<string> AudioExtensions { get; set; } = new()
    {
        ".mp3", ".wav", ".ogg", ".flac", ".m4a"
    };
}
