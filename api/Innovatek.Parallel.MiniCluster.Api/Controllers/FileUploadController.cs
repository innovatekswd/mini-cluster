using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using System;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;

namespace Innovatek.Parallel.MiniCluster.Api.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/files")]
    public class FileUploadController : ControllerBase
    {
        private readonly string _basePath;
        private readonly ILogger<FileUploadController> _logger;

        public FileUploadController(IConfiguration configuration, ILogger<FileUploadController> logger)
        {
            _logger = logger;
            
            // Try to get from configuration, fall back to current directory
            var configPath = configuration.GetValue<string>("FileUpload:BasePath");
            if (!string.IsNullOrEmpty(configPath))
            {
                _basePath = configPath;
            }
            else
            {
                var currentDir = Directory.GetCurrentDirectory();
                _basePath = Path.Combine(currentDir, "UploadedFiles");
                
                // If current directory is read-only (like /opt), use temp directory
                try
                {
                    var testDir = Path.Combine(_basePath, ".writetest");
                    Directory.CreateDirectory(testDir);
                    Directory.Delete(testDir);
                }
                catch
                {
                    _basePath = Path.Combine(Path.GetTempPath(), "minicluster-uploads");
                    _logger.LogWarning("Using temp directory for uploads: {Path}", _basePath);
                }
            }

            if (!Directory.Exists(_basePath))
                Directory.CreateDirectory(_basePath);
                
            _logger.LogInformation("File upload directory: {Path}", _basePath);
        }

        // POST: api/files/upload
        [HttpPost("upload")]
        public async Task<IActionResult> UploadFile([FromForm] 
        FileUploadForm form)
        {
            if (form.File == null || form.File.Length == 0)
                return BadRequest("No file uploaded.");

            if (string.IsNullOrWhiteSpace(form.Folder))
                return BadRequest("Target folder is required.");

            // Sanitize folder to prevent directory traversal
            var sanitizedFolder = form.Folder.Replace("..", "").TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            var targetFolder = Path.Combine(_basePath, sanitizedFolder);

            if (!Directory.Exists(targetFolder))
                Directory.CreateDirectory(targetFolder);

            var filePath = Path.Combine(targetFolder, form.File.FileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await form.File.CopyToAsync(stream);
            }

            return Ok(new { fileName = form.File.FileName, folder = sanitizedFolder, message = "File uploaded successfully." });
        }

        // POST: api/files/upload-multiple
        [HttpPost("upload-multiple")]
        public async Task<IActionResult> UploadMultipleFiles([FromForm] MultipleFilesUploadForm form)
        {
            if (form.Files == null || form.Files.Count == 0)
                return BadRequest("No files uploaded.");

            if (string.IsNullOrWhiteSpace(form.Folder))
                return BadRequest("Target folder is required.");

            var sanitizedFolder = form.Folder.Replace("..", "").TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            var targetFolder = Path.Combine(_basePath, sanitizedFolder);

            if (!Directory.Exists(targetFolder))
                Directory.CreateDirectory(targetFolder);

            var uploadedFiles = new List<string>();
            var errors = new List<string>();

            foreach (var file in form.Files)
            {
                try
                {
                    var filePath = Path.Combine(targetFolder, file.FileName);
                    using (var stream = new FileStream(filePath, FileMode.Create))
                    {
                        await file.CopyToAsync(stream);
                    }
                    uploadedFiles.Add(file.FileName);
                }
                catch (Exception ex)
                {
                    errors.Add($"{file.FileName}: {ex.Message}");
                }
            }

            return Ok(new
            {
                uploaded = uploadedFiles.Count,
                failed = errors.Count,
                files = uploadedFiles,
                errors = errors,
                message = $"Uploaded {uploadedFiles.Count} of {form.Files.Count} files successfully."
            });
        }

        // GET: api/files/download?folder=somefolder&fileName=somefile.txt
        [HttpGet("download")]
        public async Task<IActionResult> DownloadFile([FromQuery] string folder, [FromQuery] string? fileName = null)
        {
            if (string.IsNullOrWhiteSpace(folder))
                return BadRequest("Folder is required.");

            var sanitizedFolder = folder.Replace("..", "").TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            var targetPath = Path.Combine(_basePath, sanitizedFolder);

            // If fileName is provided, download the specific file
            if (!string.IsNullOrWhiteSpace(fileName))
            {
                var filePath = Path.Combine(targetPath, fileName);

                if (!System.IO.File.Exists(filePath))
                    return NotFound("File not found.");

                var memory = new MemoryStream();
                using (var stream = new FileStream(filePath, FileMode.Open))
                {
                    await stream.CopyToAsync(memory);
                }
                memory.Position = 0;
                return File(memory, "application/octet-stream", fileName);
            }
            else
            {
                // No fileName provided, download the entire folder as a zip
                if (!Directory.Exists(targetPath))
                    return NotFound("Folder not found.");

                var zipMemory = new MemoryStream();
                using (var archive = new ZipArchive(zipMemory, ZipArchiveMode.Create, true))
                {
                    await AddDirectoryToZip(archive, targetPath, sanitizedFolder);
                }
                zipMemory.Position = 0;

                var zipFileName = Path.GetFileName(sanitizedFolder) + ".zip";
                return File(zipMemory, "application/zip", zipFileName);
            }
        }

        // Helper method to recursively add directory contents to zip
        private async Task AddDirectoryToZip(ZipArchive archive, string sourceDir, string relativePath)
        {
            var dirInfo = new DirectoryInfo(sourceDir);
            
            foreach (var file in dirInfo.GetFiles())
            {
                var entryName = Path.Combine(relativePath, file.Name).Replace('\\', '/');
                var entry = archive.CreateEntry(entryName);
                
                using (var entryStream = entry.Open())
                using (var fileStream = file.OpenRead())
                {
                    await fileStream.CopyToAsync(entryStream);
                }
            }

            foreach (var subDir in dirInfo.GetDirectories())
            {
                var subRelativePath = Path.Combine(relativePath, subDir.Name);
                await AddDirectoryToZip(archive, subDir.FullName, subRelativePath);
            }
        }

        [HttpPost("upload-folder")]
        public async Task<IActionResult> UploadFolder([FromForm] FolderUploadForm form)
        {
            if (form.Files == null || form.Files.Count == 0)
                return BadRequest("No files uploaded.");

            var basePath = Path.Combine(Directory.GetCurrentDirectory(), "UploadedFolders");
            foreach (var file in form.Files)
            {
                var sanitizedPath = file.FileName.Replace("..", "").TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
                var fullPath = Path.Combine(basePath, sanitizedPath);

                var directory = Path.GetDirectoryName(fullPath);
                if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
                    Directory.CreateDirectory(directory);

                using (var stream = new FileStream(fullPath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }
            }

            return Ok(new { message = "Folder uploaded successfully." });
        }

        // GET: api/files/list?folder=somefolder
        [HttpGet("list")]
        public IActionResult ListFiles([FromQuery] string folder = "")
        {
            var sanitizedFolder = folder.Replace("..", "").TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            var targetPath = string.IsNullOrEmpty(sanitizedFolder) ? _basePath : Path.Combine(_basePath, sanitizedFolder);

            if (!Directory.Exists(targetPath))
                return NotFound("Folder not found.");

            var dirInfo = new DirectoryInfo(targetPath);
            var items = new List<FileSystemItemDto>();

            // Add directories
            foreach (var dir in dirInfo.GetDirectories())
            {
                items.Add(new FileSystemItemDto
                {
                    Name = dir.Name,
                    Type = "directory",
                    Size = 0,
                    Modified = dir.LastWriteTime,
                    Path = string.IsNullOrEmpty(sanitizedFolder) ? dir.Name : Path.Combine(sanitizedFolder, dir.Name).Replace("\\", "/")
                });
            }

            // Add files
            foreach (var file in dirInfo.GetFiles())
            {
                items.Add(new FileSystemItemDto
                {
                    Name = file.Name,
                    Type = "file",
                    Size = file.Length,
                    Modified = file.LastWriteTime,
                    Path = string.IsNullOrEmpty(sanitizedFolder) ? file.Name : Path.Combine(sanitizedFolder, file.Name).Replace("\\", "/")
                });
            }

            return Ok(new
            {
                folder = sanitizedFolder,
                items = items.OrderBy(i => i.Type).ThenBy(i => i.Name).ToList()
            });
        }
    }

    // Add the missing FileUploadForm class
    public class FileUploadForm
    {
        public required IFormFile File { get; set; }
        public required string Folder { get; set; }
    }

    public class FolderUploadForm
    {
        public required IFormFileCollection Files { get; set; }
    }

    public class MultipleFilesUploadForm
    {
        public required IFormFileCollection Files { get; set; }
        public required string Folder { get; set; }
    }

    public class FileSystemItemDto
    {
        public required string Name { get; set; }
        public required string Type { get; set; } // "file" or "directory"
        public long Size { get; set; }
        public DateTime Modified { get; set; }
        public required string Path { get; set; }
    }
}
