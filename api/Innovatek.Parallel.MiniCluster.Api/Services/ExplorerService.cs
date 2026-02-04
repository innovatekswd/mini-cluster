using Innovatek.Parallel.MiniCluster.Api.Configuration;
using Innovatek.Parallel.MiniCluster.Api.Models.Explorer;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.Options;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace Innovatek.Parallel.MiniCluster.Api.Services;

/// <summary>
/// Service for file explorer operations
/// </summary>
public class ExplorerService
{
    private readonly ExplorerOptions _options;
    private readonly ILogger<ExplorerService> _logger;
    private readonly FileExtensionContentTypeProvider _contentTypeProvider;

    public ExplorerService(IOptions<ExplorerOptions> options, ILogger<ExplorerService> logger)
    {
        _options = options.Value;
        _logger = logger;
        _contentTypeProvider = new FileExtensionContentTypeProvider();
    }

    /// <summary>
    /// Validate that a path is within allowed directories
    /// </summary>
    public bool IsPathAllowed(string path)
    {
        try
        {
            var fullPath = Path.GetFullPath(path);

            // Check if path is in blocked list
            foreach (var blocked in _options.BlockedPaths)
            {
                var blockedFull = Path.GetFullPath(blocked);
                if (fullPath.StartsWith(blockedFull, StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogWarning("Path {Path} is blocked", path);
                    return false;
                }
            }

            // Check if path is in allowed list
            foreach (var allowed in _options.AllowedPaths)
            {
                var allowedFull = Path.GetFullPath(allowed);
                if (fullPath.StartsWith(allowedFull, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }

            _logger.LogWarning("Path {Path} is not in allowed paths", path);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating path {Path}", path);
            return false;
        }
    }

    /// <summary>
    /// Get the list of allowed root paths
    /// </summary>
    public List<FileItem> GetRootPaths()
    {
        var roots = new List<FileItem>();

        foreach (var allowedPath in _options.AllowedPaths)
        {
            if (Directory.Exists(allowedPath))
            {
                var dirInfo = new DirectoryInfo(allowedPath);
                roots.Add(new FileItem
                {
                    Name = dirInfo.Name,
                    Path = dirInfo.FullName,
                    Type = "directory",
                    Modified = dirInfo.LastWriteTimeUtc,
                    Created = dirInfo.CreationTimeUtc,
                    IsReadable = true,
                    IsWritable = HasWriteAccess(allowedPath),
                    Category = "directory"
                });
            }
        }

        return roots;
    }

    /// <summary>
    /// List contents of a directory
    /// </summary>
    public DirectoryListing ListDirectory(string path, string sortField = "name", string sortOrder = "asc", int skip = 0, int take = 500)
    {
        if (!IsPathAllowed(path))
        {
            throw new UnauthorizedAccessException($"Access to path '{path}' is not allowed");
        }

        if (!Directory.Exists(path))
        {
            throw new DirectoryNotFoundException($"Directory '{path}' not found");
        }

        var dirInfo = new DirectoryInfo(path);
        var items = new List<FileItem>();

        // Get directories
        try
        {
            foreach (var dir in dirInfo.GetDirectories())
            {
                if (!_options.ShowHiddenFiles && dir.Name.StartsWith("."))
                    continue;

                items.Add(CreateFileItem(dir));
            }
        }
        catch (UnauthorizedAccessException)
        {
            _logger.LogWarning("Access denied listing directories in {Path}", path);
        }

        // Get files
        try
        {
            foreach (var file in dirInfo.GetFiles())
            {
                if (!_options.ShowHiddenFiles && file.Name.StartsWith("."))
                    continue;

                items.Add(CreateFileItem(file));
            }
        }
        catch (UnauthorizedAccessException)
        {
            _logger.LogWarning("Access denied listing files in {Path}", path);
        }

        // Sort items
        items = SortItems(items, sortField, sortOrder);

        var totalItems = items.Count;
        var pagedItems = items.Skip(skip).Take(take).ToList();

        // Get parent path
        string? parentPath = null;
        if (dirInfo.Parent != null && IsPathAllowed(dirInfo.Parent.FullName))
        {
            parentPath = dirInfo.Parent.FullName;
        }

        return new DirectoryListing
        {
            Path = dirInfo.FullName,
            Parent = parentPath,
            Items = pagedItems,
            TotalItems = totalItems,
            HasMore = skip + take < totalItems
        };
    }

    /// <summary>
    /// Get detailed file information
    /// </summary>
    public Models.Explorer.FileInfo GetFileInfo(string path)
    {
        if (!IsPathAllowed(path))
        {
            throw new UnauthorizedAccessException($"Access to path '{path}' is not allowed");
        }

        if (!File.Exists(path) && !Directory.Exists(path))
        {
            throw new FileNotFoundException($"Path '{path}' not found");
        }

        var isFile = File.Exists(path);

        if (isFile)
        {
            var fileInfo = new System.IO.FileInfo(path);
            return new Models.Explorer.FileInfo
            {
                Name = fileInfo.Name,
                Path = fileInfo.FullName,
                Size = fileInfo.Length,
                Modified = fileInfo.LastWriteTimeUtc,
                Created = fileInfo.CreationTimeUtc,
                Permissions = GetPermissionsString(path),
                Owner = GetOwner(path),
                Group = GetGroup(path),
                MimeType = GetMimeType(path),
                IsReadable = HasReadAccess(path),
                IsWritable = HasWriteAccess(path),
                IsExecutable = HasExecuteAccess(path),
                IsSymlink = IsSymbolicLink(path),
                SymlinkTarget = GetSymlinkTarget(path),
                Category = GetFileCategory(fileInfo.Extension)
            };
        }
        else
        {
            var dirInfo = new DirectoryInfo(path);
            return new Models.Explorer.FileInfo
            {
                Name = dirInfo.Name,
                Path = dirInfo.FullName,
                Size = 0,
                Modified = dirInfo.LastWriteTimeUtc,
                Created = dirInfo.CreationTimeUtc,
                Permissions = GetPermissionsString(path),
                Owner = GetOwner(path),
                Group = GetGroup(path),
                MimeType = "inode/directory",
                IsReadable = HasReadAccess(path),
                IsWritable = HasWriteAccess(path),
                IsExecutable = true,
                IsSymlink = IsSymbolicLink(path),
                SymlinkTarget = GetSymlinkTarget(path),
                Category = "directory"
            };
        }
    }

    /// <summary>
    /// Read file content as string
    /// </summary>
    public async Task<string> ReadFileContent(string path)
    {
        if (!IsPathAllowed(path))
        {
            throw new UnauthorizedAccessException($"Access to path '{path}' is not allowed");
        }

        if (!File.Exists(path))
        {
            throw new FileNotFoundException($"File '{path}' not found");
        }

        var fileInfo = new System.IO.FileInfo(path);
        var maxSize = _options.MaxEditFileSizeMB * 1024 * 1024;

        if (fileInfo.Length > maxSize)
        {
            throw new InvalidOperationException($"File is too large to edit. Maximum size is {_options.MaxEditFileSizeMB}MB");
        }

        return await File.ReadAllTextAsync(path);
    }

    /// <summary>
    /// Read file as byte array (for binary files)
    /// </summary>
    public async Task<byte[]> ReadFileBytes(string path)
    {
        if (!IsPathAllowed(path))
        {
            throw new UnauthorizedAccessException($"Access to path '{path}' is not allowed");
        }

        if (!File.Exists(path))
        {
            throw new FileNotFoundException($"File '{path}' not found");
        }

        return await File.ReadAllBytesAsync(path);
    }

    /// <summary>
    /// Save file content
    /// </summary>
    public async Task SaveFile(string path, string content, string encoding = "utf-8")
    {
        if (!IsPathAllowed(path))
        {
            throw new UnauthorizedAccessException($"Access to path '{path}' is not allowed");
        }

        var enc = Encoding.GetEncoding(encoding);
        await File.WriteAllTextAsync(path, content, enc);
        _logger.LogInformation("File saved: {Path}", path);
    }

    /// <summary>
    /// Create a new file
    /// </summary>
    public async Task CreateFile(string path, string content = "")
    {
        if (!IsPathAllowed(path))
        {
            throw new UnauthorizedAccessException($"Access to path '{path}' is not allowed");
        }

        if (File.Exists(path))
        {
            throw new InvalidOperationException($"File '{path}' already exists");
        }

        // Ensure parent directory exists
        var dir = Path.GetDirectoryName(path);
        if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
        {
            Directory.CreateDirectory(dir);
        }

        await File.WriteAllTextAsync(path, content);
        _logger.LogInformation("File created: {Path}", path);
    }

    /// <summary>
    /// Create a new directory
    /// </summary>
    public void CreateDirectory(string path)
    {
        if (!IsPathAllowed(path))
        {
            throw new UnauthorizedAccessException($"Access to path '{path}' is not allowed");
        }

        if (Directory.Exists(path))
        {
            throw new InvalidOperationException($"Directory '{path}' already exists");
        }

        Directory.CreateDirectory(path);
        _logger.LogInformation("Directory created: {Path}", path);
    }

    /// <summary>
    /// Delete a file or directory
    /// </summary>
    public void Delete(string path, bool recursive = false)
    {
        if (!IsPathAllowed(path))
        {
            throw new UnauthorizedAccessException($"Access to path '{path}' is not allowed");
        }

        if (File.Exists(path))
        {
            File.Delete(path);
            _logger.LogInformation("File deleted: {Path}", path);
        }
        else if (Directory.Exists(path))
        {
            Directory.Delete(path, recursive);
            _logger.LogInformation("Directory deleted: {Path}", path);
        }
        else
        {
            throw new FileNotFoundException($"Path '{path}' not found");
        }
    }

    /// <summary>
    /// Move or rename a file/directory
    /// </summary>
    public void Move(string source, string destination)
    {
        if (!IsPathAllowed(source))
        {
            throw new UnauthorizedAccessException($"Access to source path '{source}' is not allowed");
        }

        if (!IsPathAllowed(destination))
        {
            throw new UnauthorizedAccessException($"Access to destination path '{destination}' is not allowed");
        }

        if (File.Exists(source))
        {
            File.Move(source, destination);
            _logger.LogInformation("File moved: {Source} -> {Destination}", source, destination);
        }
        else if (Directory.Exists(source))
        {
            Directory.Move(source, destination);
            _logger.LogInformation("Directory moved: {Source} -> {Destination}", source, destination);
        }
        else
        {
            throw new FileNotFoundException($"Source path '{source}' not found");
        }
    }

    /// <summary>
    /// Copy a file or directory
    /// </summary>
    public void Copy(string source, string destination, bool overwrite = false)
    {
        if (!IsPathAllowed(source))
        {
            throw new UnauthorizedAccessException($"Access to source path '{source}' is not allowed");
        }

        if (!IsPathAllowed(destination))
        {
            throw new UnauthorizedAccessException($"Access to destination path '{destination}' is not allowed");
        }

        if (File.Exists(source))
        {
            // Ensure destination directory exists
            var destDir = Path.GetDirectoryName(destination);
            if (!string.IsNullOrEmpty(destDir) && !Directory.Exists(destDir))
            {
                Directory.CreateDirectory(destDir);
            }

            File.Copy(source, destination, overwrite);
            _logger.LogInformation("File copied: {Source} -> {Destination}", source, destination);
        }
        else if (Directory.Exists(source))
        {
            CopyDirectory(source, destination, overwrite);
            _logger.LogInformation("Directory copied: {Source} -> {Destination}", source, destination);
        }
        else
        {
            throw new FileNotFoundException($"Source path '{source}' not found");
        }
    }

    /// <summary>
    /// Search for files/directories
    /// </summary>
    public SearchResponse Search(SearchRequest request)
    {
        if (!IsPathAllowed(request.BasePath))
        {
            throw new UnauthorizedAccessException($"Access to path '{request.BasePath}' is not allowed");
        }

        var results = new List<SearchResult>();
        var searchOption = request.Recursive ? SearchOption.AllDirectories : SearchOption.TopDirectoryOnly;

        try
        {
            // Search files
            if (request.Type == "all" || request.Type == "file")
            {
                var files = Directory.EnumerateFiles(request.BasePath, $"*{request.Query}*", searchOption);
                foreach (var file in files.Take(request.MaxResults))
                {
                    if (!IsPathAllowed(file)) continue;

                    var fileInfo = new System.IO.FileInfo(file);
                    results.Add(new SearchResult
                    {
                        Path = file,
                        Name = fileInfo.Name,
                        Type = "file",
                        Match = request.Query
                    });

                    if (results.Count >= request.MaxResults) break;
                }
            }

            // Search directories
            if (results.Count < request.MaxResults && (request.Type == "all" || request.Type == "directory"))
            {
                var dirs = Directory.EnumerateDirectories(request.BasePath, $"*{request.Query}*", searchOption);
                foreach (var dir in dirs.Take(request.MaxResults - results.Count))
                {
                    if (!IsPathAllowed(dir)) continue;

                    var dirInfo = new DirectoryInfo(dir);
                    results.Add(new SearchResult
                    {
                        Path = dir,
                        Name = dirInfo.Name,
                        Type = "directory",
                        Match = request.Query
                    });

                    if (results.Count >= request.MaxResults) break;
                }
            }
        }
        catch (UnauthorizedAccessException)
        {
            _logger.LogWarning("Search encountered access denied in {Path}", request.BasePath);
        }

        return new SearchResponse
        {
            Results = results,
            TotalResults = results.Count,
            Truncated = results.Count >= request.MaxResults
        };
    }

    /// <summary>
    /// Execute a command in a directory
    /// </summary>
    public async Task<CommandExecutionResult> ExecuteCommand(ExecuteCommandRequest request)
    {
        if (!_options.EnableTerminal)
        {
            throw new InvalidOperationException("Terminal execution is disabled");
        }

        if (!IsPathAllowed(request.Path))
        {
            throw new UnauthorizedAccessException($"Access to path '{request.Path}' is not allowed");
        }

        if (!Directory.Exists(request.Path))
        {
            throw new DirectoryNotFoundException($"Directory '{request.Path}' not found");
        }

        var isWindows = RuntimeInformation.IsOSPlatform(OSPlatform.Windows);
        var shell = isWindows ? "cmd.exe" : "/bin/bash";
        var shellArgs = isWindows ? $"/c {request.Command}" : $"-c \"{request.Command.Replace("\"", "\\\"")}\"";

        using var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = shell,
                Arguments = shellArgs,
                WorkingDirectory = request.Path,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            }
        };

        var stdout = new StringBuilder();
        var stderr = new StringBuilder();

        process.OutputDataReceived += (s, e) => { if (e.Data != null) stdout.AppendLine(e.Data); };
        process.ErrorDataReceived += (s, e) => { if (e.Data != null) stderr.AppendLine(e.Data); };

        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        var completed = await Task.Run(() => process.WaitForExit(request.TimeoutSeconds * 1000));

        if (!completed)
        {
            process.Kill();
            return new CommandExecutionResult
            {
                Stdout = stdout.ToString(),
                Stderr = stderr.ToString(),
                ExitCode = -1,
                TimedOut = true
            };
        }

        return new CommandExecutionResult
        {
            Stdout = stdout.ToString(),
            Stderr = stderr.ToString(),
            ExitCode = process.ExitCode,
            TimedOut = false
        };
    }

    #region Helper Methods

    private FileItem CreateFileItem(DirectoryInfo dir)
    {
        int? itemCount = null;
        try
        {
            itemCount = dir.GetFileSystemInfos().Length;
        }
        catch { }

        return new FileItem
        {
            Name = dir.Name,
            Path = dir.FullName,
            Type = "directory",
            Size = 0,
            Modified = dir.LastWriteTimeUtc,
            Created = dir.CreationTimeUtc,
            Extension = "",
            MimeType = "inode/directory",
            Permissions = GetPermissionsString(dir.FullName),
            IsHidden = dir.Name.StartsWith("."),
            IsReadable = HasReadAccess(dir.FullName),
            IsWritable = HasWriteAccess(dir.FullName),
            ItemCount = itemCount,
            Category = "directory"
        };
    }

    private FileItem CreateFileItem(System.IO.FileInfo file)
    {
        return new FileItem
        {
            Name = file.Name,
            Path = file.FullName,
            Type = "file",
            Size = file.Length,
            Modified = file.LastWriteTimeUtc,
            Created = file.CreationTimeUtc,
            Extension = file.Extension.ToLowerInvariant(),
            MimeType = GetMimeType(file.FullName),
            Permissions = GetPermissionsString(file.FullName),
            IsHidden = file.Name.StartsWith("."),
            IsReadable = HasReadAccess(file.FullName),
            IsWritable = HasWriteAccess(file.FullName),
            Category = GetFileCategory(file.Extension)
        };
    }

    private string GetMimeType(string path)
    {
        if (_contentTypeProvider.TryGetContentType(path, out var contentType))
        {
            return contentType;
        }
        return "application/octet-stream";
    }

    private string GetFileCategory(string extension)
    {
        extension = extension.ToLowerInvariant();

        if (_options.EditableExtensions.Contains(extension))
            return "text";
        if (_options.ImageExtensions.Contains(extension))
            return "image";
        if (_options.VideoExtensions.Contains(extension))
            return "video";
        if (_options.AudioExtensions.Contains(extension))
            return "audio";

        return "binary";
    }

    private List<FileItem> SortItems(List<FileItem> items, string sortField, string sortOrder)
    {
        var sorted = sortField.ToLower() switch
        {
            "name" => items.OrderBy(i => i.Type == "directory" ? 0 : 1).ThenBy(i => i.Name, StringComparer.OrdinalIgnoreCase),
            "size" => items.OrderBy(i => i.Type == "directory" ? 0 : 1).ThenBy(i => i.Size),
            "modified" => items.OrderBy(i => i.Type == "directory" ? 0 : 1).ThenBy(i => i.Modified),
            "type" => items.OrderBy(i => i.Type).ThenBy(i => i.Extension).ThenBy(i => i.Name),
            _ => items.OrderBy(i => i.Type == "directory" ? 0 : 1).ThenBy(i => i.Name, StringComparer.OrdinalIgnoreCase)
        };

        return sortOrder.ToLower() == "desc" ? sorted.Reverse().ToList() : sorted.ToList();
    }

    private static bool HasReadAccess(string path)
    {
        try
        {
            if (File.Exists(path))
            {
                using var fs = File.OpenRead(path);
                return true;
            }
            else if (Directory.Exists(path))
            {
                Directory.GetFiles(path);
                return true;
            }
            return false;
        }
        catch
        {
            return false;
        }
    }

    private static bool HasWriteAccess(string path)
    {
        try
        {
            if (File.Exists(path))
            {
                using var fs = File.OpenWrite(path);
                return true;
            }
            else if (Directory.Exists(path))
            {
                var testFile = Path.Combine(path, $".writetest_{Guid.NewGuid()}");
                File.WriteAllText(testFile, "");
                File.Delete(testFile);
                return true;
            }
            return false;
        }
        catch
        {
            return false;
        }
    }

    private static bool HasExecuteAccess(string path)
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            var ext = Path.GetExtension(path).ToLower();
            return ext == ".exe" || ext == ".bat" || ext == ".cmd" || ext == ".ps1";
        }

        try
        {
            var info = new UnixFileInfo(path);
            return (info.FileAccessPermissions & FileAccessPermissions.UserExecute) != 0;
        }
        catch
        {
            return false;
        }
    }

    private static string GetPermissionsString(string path)
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            return ""; // Windows doesn't use Unix-style permissions
        }

        try
        {
            var info = new UnixFileInfo(path);
            return info.FileAccessPermissions.ToString();
        }
        catch
        {
            return "";
        }
    }

    private static string GetOwner(string path)
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            return "";
        }

        try
        {
            var info = new UnixFileInfo(path);
            return info.OwnerUser?.UserName ?? "";
        }
        catch
        {
            return "";
        }
    }

    private static string GetGroup(string path)
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            return "";
        }

        try
        {
            var info = new UnixFileInfo(path);
            return info.OwnerGroup?.GroupName ?? "";
        }
        catch
        {
            return "";
        }
    }

    private static bool IsSymbolicLink(string path)
    {
        try
        {
            var fileInfo = new System.IO.FileInfo(path);
            return fileInfo.Attributes.HasFlag(FileAttributes.ReparsePoint);
        }
        catch
        {
            return false;
        }
    }

    private static string? GetSymlinkTarget(string path)
    {
        try
        {
            if (IsSymbolicLink(path))
            {
                return new System.IO.FileInfo(path).LinkTarget;
            }
            return null;
        }
        catch
        {
            return null;
        }
    }

    private void CopyDirectory(string source, string destination, bool overwrite)
    {
        var dir = new DirectoryInfo(source);
        var dirs = dir.GetDirectories();

        Directory.CreateDirectory(destination);

        foreach (var file in dir.GetFiles())
        {
            var targetPath = Path.Combine(destination, file.Name);
            file.CopyTo(targetPath, overwrite);
        }

        foreach (var subDir in dirs)
        {
            var newDestination = Path.Combine(destination, subDir.Name);
            CopyDirectory(subDir.FullName, newDestination, overwrite);
        }
    }

    #endregion
}

#region Unix File Info Helper (for Linux)

internal class UnixFileInfo
{
    public FileAccessPermissions FileAccessPermissions { get; }
    public UnixUserInfo? OwnerUser { get; }
    public UnixGroupInfo? OwnerGroup { get; }

    public UnixFileInfo(string path)
    {
        // This is a simplified implementation
        // In production, use Mono.Posix.NETStandard package for full Unix support
        FileAccessPermissions = FileAccessPermissions.UserRead | FileAccessPermissions.UserWrite;
    }
}

internal class UnixUserInfo
{
    public string UserName { get; set; } = "";
}

internal class UnixGroupInfo
{
    public string GroupName { get; set; } = "";
}

[Flags]
internal enum FileAccessPermissions
{
    UserRead = 256,
    UserWrite = 128,
    UserExecute = 64,
    GroupRead = 32,
    GroupWrite = 16,
    GroupExecute = 8,
    OtherRead = 4,
    OtherWrite = 2,
    OtherExecute = 1
}

#endregion
