using Innovatek.Parallel.MiniCluster.Api.Models.Explorer;
using Innovatek.Parallel.MiniCluster.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;

namespace Innovatek.Parallel.MiniCluster.Api.Controllers;

/// <summary>
/// Controller for file explorer operations
/// </summary>
[ApiController]
[Authorize]
[Route("api/[controller]")]
public class ExplorerController : ControllerBase
{
    private readonly ExplorerService _explorerService;
    private readonly ArchiveService _archiveService;
    private readonly ILogger<ExplorerController> _logger;
    private readonly FileExtensionContentTypeProvider _contentTypeProvider;

    public ExplorerController(ExplorerService explorerService, ArchiveService archiveService, ILogger<ExplorerController> logger)
    {
        _explorerService = explorerService;
        _archiveService = archiveService;
        _logger = logger;
        _contentTypeProvider = new FileExtensionContentTypeProvider();
    }

    /// <summary>
    /// Get the list of allowed root paths
    /// </summary>
    [HttpGet("roots")]
    public ActionResult<List<FileItem>> GetRoots()
    {
        try
        {
            var roots = _explorerService.GetRootPaths();
            return Ok(roots);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting root paths");
            return StatusCode(500, new { error = "OPERATION_FAILED", message = ex.Message });
        }
    }

    /// <summary>
    /// List contents of a directory
    /// </summary>
    [HttpGet("list")]
    public ActionResult<DirectoryListing> ListDirectory(
        [FromQuery] string path,
        [FromQuery] string sort = "name",
        [FromQuery] string order = "asc",
        [FromQuery] int skip = 0,
        [FromQuery] int take = 500)
    {
        try
        {
            var listing = _explorerService.ListDirectory(path, sort, order, skip, take);
            return Ok(listing);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = "ACCESS_DENIED", message = ex.Message, path });
        }
        catch (DirectoryNotFoundException ex)
        {
            return NotFound(new { error = "NOT_FOUND", message = ex.Message, path });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing directory {Path}", path);
            return StatusCode(500, new { error = "OPERATION_FAILED", message = ex.Message });
        }
    }

    /// <summary>
    /// Get detailed file/directory information
    /// </summary>
    [HttpGet("info")]
    public ActionResult<Models.Explorer.FileInfo> GetInfo([FromQuery] string path)
    {
        try
        {
            var info = _explorerService.GetFileInfo(path);
            return Ok(info);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = "ACCESS_DENIED", message = ex.Message, path });
        }
        catch (FileNotFoundException ex)
        {
            return NotFound(new { error = "NOT_FOUND", message = ex.Message, path });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting info for {Path}", path);
            return StatusCode(500, new { error = "OPERATION_FAILED", message = ex.Message });
        }
    }

    /// <summary>
    /// Get file content (for text files)
    /// </summary>
    [HttpGet("file")]
    public async Task<IActionResult> GetFileContent([FromQuery] string path, [FromQuery] bool raw = false)
    {
        try
        {
            if (raw)
            {
                var bytes = await _explorerService.ReadFileBytes(path);
                _contentTypeProvider.TryGetContentType(path, out var contentType);
                return File(bytes, contentType ?? "application/octet-stream");
            }
            else
            {
                var content = await _explorerService.ReadFileContent(path);
                return Ok(new { content, path });
            }
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = "ACCESS_DENIED", message = ex.Message, path });
        }
        catch (FileNotFoundException ex)
        {
            return NotFound(new { error = "NOT_FOUND", message = ex.Message, path });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = "FILE_TOO_LARGE", message = ex.Message, path });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading file {Path}", path);
            return StatusCode(500, new { error = "OPERATION_FAILED", message = ex.Message });
        }
    }

    /// <summary>
    /// Save file content
    /// </summary>
    [HttpPut("file")]
    public async Task<IActionResult> SaveFile([FromBody] SaveFileRequest request)
    {
        try
        {
            await _explorerService.SaveFile(request.Path, request.Content, request.Encoding);
            return Ok(new { success = true, path = request.Path });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = "ACCESS_DENIED", message = ex.Message, path = request.Path });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving file {Path}", request.Path);
            return StatusCode(500, new { error = "OPERATION_FAILED", message = ex.Message });
        }
    }

    /// <summary>
    /// Create a new file
    /// </summary>
    [HttpPost("file")]
    public async Task<IActionResult> CreateFile([FromBody] CreateFileRequest request)
    {
        try
        {
            await _explorerService.CreateFile(request.Path, request.Content);
            return Ok(new { success = true, path = request.Path });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = "ACCESS_DENIED", message = ex.Message, path = request.Path });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = "ALREADY_EXISTS", message = ex.Message, path = request.Path });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating file {Path}", request.Path);
            return StatusCode(500, new { error = "OPERATION_FAILED", message = ex.Message });
        }
    }

    /// <summary>
    /// Create a new directory
    /// </summary>
    [HttpPost("mkdir")]
    public IActionResult CreateDirectory([FromBody] CreateDirectoryRequest request)
    {
        try
        {
            _explorerService.CreateDirectory(request.Path);
            return Ok(new { success = true, path = request.Path });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = "ACCESS_DENIED", message = ex.Message, path = request.Path });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = "ALREADY_EXISTS", message = ex.Message, path = request.Path });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating directory {Path}", request.Path);
            return StatusCode(500, new { error = "OPERATION_FAILED", message = ex.Message });
        }
    }

    /// <summary>
    /// Delete file(s) or directory
    /// </summary>
    [HttpDelete("delete")]
    public IActionResult Delete([FromQuery] string path, [FromQuery] bool recursive = false)
    {
        try
        {
            _explorerService.Delete(path, recursive);
            return Ok(new { success = true, path });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = "ACCESS_DENIED", message = ex.Message, path });
        }
        catch (FileNotFoundException ex)
        {
            return NotFound(new { error = "NOT_FOUND", message = ex.Message, path });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting {Path}", path);
            return StatusCode(500, new { error = "OPERATION_FAILED", message = ex.Message });
        }
    }

    /// <summary>
    /// Delete multiple files/directories
    /// </summary>
    [HttpPost("delete")]
    public IActionResult DeleteMultiple([FromBody] DeleteRequest request)
    {
        var results = new List<object>();
        var hasErrors = false;

        foreach (var path in request.Paths)
        {
            try
            {
                _explorerService.Delete(path, request.Recursive);
                results.Add(new { path, success = true });
            }
            catch (Exception ex)
            {
                hasErrors = true;
                results.Add(new { path, success = false, error = ex.Message });
            }
        }

        return hasErrors ? StatusCode(207, new { results }) : Ok(new { results });
    }

    /// <summary>
    /// Move or rename a file/directory
    /// </summary>
    [HttpPost("move")]
    public IActionResult Move([FromBody] MoveRequest request)
    {
        try
        {
            _explorerService.Move(request.Source, request.Destination);
            return Ok(new { success = true, source = request.Source, destination = request.Destination });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = "ACCESS_DENIED", message = ex.Message });
        }
        catch (FileNotFoundException ex)
        {
            return NotFound(new { error = "NOT_FOUND", message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error moving {Source} to {Destination}", request.Source, request.Destination);
            return StatusCode(500, new { error = "OPERATION_FAILED", message = ex.Message });
        }
    }

    /// <summary>
    /// Copy a file/directory
    /// </summary>
    [HttpPost("copy")]
    public IActionResult Copy([FromBody] CopyRequest request)
    {
        try
        {
            _explorerService.Copy(request.Source, request.Destination, request.Overwrite);
            return Ok(new { success = true, source = request.Source, destination = request.Destination });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = "ACCESS_DENIED", message = ex.Message });
        }
        catch (FileNotFoundException ex)
        {
            return NotFound(new { error = "NOT_FOUND", message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error copying {Source} to {Destination}", request.Source, request.Destination);
            return StatusCode(500, new { error = "OPERATION_FAILED", message = ex.Message });
        }
    }

    /// <summary>
    /// Upload files to a directory
    /// </summary>
    [HttpPost("upload")]
    [RequestSizeLimit(104857600)] // 100MB
    public async Task<IActionResult> Upload([FromQuery] string path, [FromForm] List<IFormFile> files)
    {
        if (!_explorerService.IsPathAllowed(path))
        {
            return StatusCode(403, new { error = "ACCESS_DENIED", message = "Upload path is not allowed", path });
        }

        if (!Directory.Exists(path))
        {
            return NotFound(new { error = "NOT_FOUND", message = "Target directory not found", path });
        }

        var results = new List<object>();
        var hasErrors = false;

        foreach (var file in files)
        {
            var filePath = Path.Combine(path, file.FileName);
            try
            {
                using var stream = new FileStream(filePath, FileMode.Create);
                await file.CopyToAsync(stream);
                results.Add(new { fileName = file.FileName, path = filePath, size = file.Length, success = true });
            }
            catch (Exception ex)
            {
                hasErrors = true;
                results.Add(new { fileName = file.FileName, success = false, error = ex.Message });
            }
        }

        return hasErrors ? StatusCode(207, new { results }) : Ok(new { results });
    }

    /// <summary>
    /// Download a file
    /// </summary>
    [HttpGet("download")]
    public async Task<IActionResult> Download([FromQuery] string path)
    {
        try
        {
            if (!_explorerService.IsPathAllowed(path))
            {
                return StatusCode(403, new { error = "ACCESS_DENIED", message = "Path is not allowed", path });
            }

            if (!System.IO.File.Exists(path))
            {
                return NotFound(new { error = "NOT_FOUND", message = "File not found", path });
            }

            var bytes = await System.IO.File.ReadAllBytesAsync(path);
            var fileName = Path.GetFileName(path);
            _contentTypeProvider.TryGetContentType(path, out var contentType);

            return File(bytes, contentType ?? "application/octet-stream", fileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error downloading {Path}", path);
            return StatusCode(500, new { error = "OPERATION_FAILED", message = ex.Message });
        }
    }

    /// <summary>
    /// Search for files/directories
    /// </summary>
    [HttpGet("search")]
    public ActionResult<SearchResponse> Search(
        [FromQuery] string path,
        [FromQuery] string query,
        [FromQuery] bool recursive = true,
        [FromQuery] string type = "all",
        [FromQuery] int maxResults = 100)
    {
        try
        {
            var request = new SearchRequest
            {
                BasePath = path,
                Query = query,
                Recursive = recursive,
                Type = type,
                MaxResults = maxResults
            };

            var results = _explorerService.Search(request);
            return Ok(results);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = "ACCESS_DENIED", message = ex.Message, path });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching in {Path}", path);
            return StatusCode(500, new { error = "OPERATION_FAILED", message = ex.Message });
        }
    }

    /// <summary>
    /// Execute a command in a directory
    /// </summary>
    [HttpPost("exec")]
    public async Task<ActionResult<CommandExecutionResult>> ExecuteCommand([FromBody] ExecuteCommandRequest request)
    {
        try
        {
            var result = await _explorerService.ExecuteCommand(request);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = "DISABLED", message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = "ACCESS_DENIED", message = ex.Message, path = request.Path });
        }
        catch (DirectoryNotFoundException ex)
        {
            return NotFound(new { error = "NOT_FOUND", message = ex.Message, path = request.Path });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error executing command in {Path}", request.Path);
            return StatusCode(500, new { error = "OPERATION_FAILED", message = ex.Message });
        }
    }

    #region Archive Operations

    /// <summary>
    /// Compress files/directories into an archive.
    /// Supported formats: zip, tar.gz, tar, tar.bz2, 7z, gz
    /// </summary>
    [HttpPost("compress")]
    public async Task<ActionResult<ArchiveOperationResult>> Compress([FromBody] CompressRequest request)
    {
        try
        {
            if (!ArchiveFormats.WritableFormats.Contains(request.Format.ToLowerInvariant()))
            {
                return BadRequest(new { error = "UNSUPPORTED_FORMAT", message = $"Format '{request.Format}' is not supported. Use: {string.Join(", ", ArchiveFormats.WritableFormats)}" });
            }

            var result = await _archiveService.CompressAsync(request);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = "ACCESS_DENIED", message = ex.Message });
        }
        catch (FileNotFoundException ex)
        {
            return NotFound(new { error = "NOT_FOUND", message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = "INVALID_OPERATION", message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error compressing files");
            return StatusCode(500, new { error = "OPERATION_FAILED", message = ex.Message });
        }
    }

    /// <summary>
    /// Extract an archive to a destination directory.
    /// Auto-detects format. Supports: zip, tar, tar.gz, tar.bz2, tar.xz, 7z, rar, gz, bz2, xz, lzma
    /// </summary>
    [HttpPost("extract")]
    public async Task<ActionResult<ArchiveOperationResult>> Extract([FromBody] ExtractRequest request)
    {
        try
        {
            var result = await _archiveService.ExtractAsync(request);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = "ACCESS_DENIED", message = ex.Message });
        }
        catch (FileNotFoundException ex)
        {
            return NotFound(new { error = "NOT_FOUND", message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = "INVALID_OPERATION", message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error extracting archive {Path}", request.ArchivePath);
            return StatusCode(500, new { error = "OPERATION_FAILED", message = ex.Message });
        }
    }

    /// <summary>
    /// List contents of an archive without extracting.
    /// Auto-detects format.
    /// </summary>
    [HttpGet("archive-contents")]
    public async Task<ActionResult<ArchiveContentsResponse>> GetArchiveContents([FromQuery] string path)
    {
        try
        {
            var result = await _archiveService.ListContentsAsync(path);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { error = "ACCESS_DENIED", message = ex.Message, path });
        }
        catch (FileNotFoundException ex)
        {
            return NotFound(new { error = "NOT_FOUND", message = ex.Message, path });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reading archive contents {Path}", path);
            return StatusCode(500, new { error = "OPERATION_FAILED", message = ex.Message });
        }
    }

    /// <summary>
    /// Get list of supported archive formats
    /// </summary>
    [HttpGet("archive-formats")]
    public ActionResult GetArchiveFormats()
    {
        return Ok(new
        {
            writable = ArchiveFormats.WritableFormats.Select(f => new
            {
                format = f,
                name = ArchiveFormats.GetFormatDisplayName(f)
            }),
            extractable = ArchiveFormats.ArchiveExtensions
        });
    }

    #endregion
}
