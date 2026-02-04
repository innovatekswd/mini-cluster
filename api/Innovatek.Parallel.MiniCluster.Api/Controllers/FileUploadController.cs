using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using System.IO;
using System.Threading.Tasks;
using System.Collections.Generic; // Add this to resolve List<T> used in FolderUploadForm

namespace Innovatek.Parallel.MiniCluster.Api.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/files")]
    public class FileUploadController : ControllerBase
    {
        private readonly string _basePath = Path.Combine(Directory.GetCurrentDirectory(), "UploadedFiles");

        public FileUploadController()
        {
            if (!Directory.Exists(_basePath))
                Directory.CreateDirectory(_basePath);
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

        // GET: api/files/download?folder=somefolder&fileName=somefile.txt
        [HttpGet("download")]
        public async Task<IActionResult> DownloadFile([FromQuery] string folder, [FromQuery] string fileName)
        {
            if (string.IsNullOrWhiteSpace(folder) || string.IsNullOrWhiteSpace(fileName))
                return BadRequest("Folder and fileName are required.");

            var sanitizedFolder = folder.Replace("..", "").TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            var filePath = Path.Combine(_basePath, sanitizedFolder, fileName);

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
}
