using System.ComponentModel.DataAnnotations;

namespace Innovatek.Parallel.MiniCluster.Api.Models.Explorer;

/// <summary>
/// Request to create a new file
/// </summary>
public class CreateFileRequest
{
    [Required]
    public string Path { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;
}

/// <summary>
/// Request to create a new directory
/// </summary>
public class CreateDirectoryRequest
{
    [Required]
    public string Path { get; set; } = string.Empty;
}

/// <summary>
/// Request to move or rename a file/directory
/// </summary>
public class MoveRequest
{
    [Required]
    public string Source { get; set; } = string.Empty;

    [Required]
    public string Destination { get; set; } = string.Empty;
}

/// <summary>
/// Request to copy a file/directory
/// </summary>
public class CopyRequest
{
    [Required]
    public string Source { get; set; } = string.Empty;

    [Required]
    public string Destination { get; set; } = string.Empty;

    /// <summary>
    /// Whether to overwrite if destination exists
    /// </summary>
    public bool Overwrite { get; set; } = false;
}

/// <summary>
/// Request to delete file(s) or directory
/// </summary>
public class DeleteRequest
{
    [Required]
    public List<string> Paths { get; set; } = new();

    /// <summary>
    /// Whether to delete directories recursively
    /// </summary>
    public bool Recursive { get; set; } = false;
}

/// <summary>
/// Request to save/update file content
/// </summary>
public class SaveFileRequest
{
    [Required]
    public string Path { get; set; } = string.Empty;

    [Required]
    public string Content { get; set; } = string.Empty;

    /// <summary>
    /// Optional encoding (default: utf-8)
    /// </summary>
    public string Encoding { get; set; } = "utf-8";
}

/// <summary>
/// Request to execute a command in a directory
/// </summary>
public class ExecuteCommandRequest
{
    [Required]
    public string Path { get; set; } = string.Empty;

    [Required]
    public string Command { get; set; } = string.Empty;

    /// <summary>
    /// Timeout in seconds (default: 30)
    /// </summary>
    public int TimeoutSeconds { get; set; } = 30;
}

/// <summary>
/// Response from command execution
/// </summary>
public class CommandExecutionResult
{
    public string Stdout { get; set; } = string.Empty;
    public string Stderr { get; set; } = string.Empty;
    public int ExitCode { get; set; }
    public bool TimedOut { get; set; }
}

/// <summary>
/// Search request
/// </summary>
public class SearchRequest
{
    [Required]
    public string BasePath { get; set; } = string.Empty;

    [Required]
    public string Query { get; set; } = string.Empty;

    /// <summary>
    /// Whether to search recursively
    /// </summary>
    public bool Recursive { get; set; } = true;

    /// <summary>
    /// Filter by type: "file", "directory", or "all"
    /// </summary>
    public string Type { get; set; } = "all";

    /// <summary>
    /// Maximum results to return
    /// </summary>
    public int MaxResults { get; set; } = 100;
}

/// <summary>
/// Search result item
/// </summary>
public class SearchResult
{
    public string Path { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Match { get; set; } = string.Empty;
}

/// <summary>
/// Search response
/// </summary>
public class SearchResponse
{
    public List<SearchResult> Results { get; set; } = new();
    public int TotalResults { get; set; }
    public bool Truncated { get; set; }
}
