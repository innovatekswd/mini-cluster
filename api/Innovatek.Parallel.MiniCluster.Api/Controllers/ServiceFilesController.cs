using AutoMapper;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Services;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Innovatek.Parallel.TemplateEngine;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing.Constraints;
using Microsoft.EntityFrameworkCore;
using System.Text;


namespace Innovatek.Parallel.MiniCluster.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/services")]
public class ServiceFilesController : ControllerBase
{
    private readonly AppDbContext _dbContext;
    private readonly IMapper _mapper;
    private readonly IVariableResolverFactory _variableResolverFactory;
    private readonly IIdentifierResolver _resolver;

    public ServiceFilesController(AppDbContext db,
        IMapper mapper,
        IVariableResolverFactory variableResolverFactory,
        IIdentifierResolver resolver)
    {
        _dbContext = db;
        _mapper = mapper;
        _variableResolverFactory = variableResolverFactory;
        _resolver = resolver;
    }

    private async Task<IVariableResolver?> GetActiveVariableResolver()
    {
        var defaultVariableGroup = await _dbContext.VariableGroups.FirstOrDefaultAsync(vg => vg.IsActive);
        if (defaultVariableGroup == null)
            return null;
        return _variableResolverFactory.CreateResolver(defaultVariableGroup.Variables);
    }

    [HttpPost("{identifier}/files")]
    public async Task<IActionResult> AttachFile(string identifier, [FromBody] AttachFileRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.FilePath))
        {
            return BadRequest("File name and file path are required.");
        }

        var result = await _resolver.ResolveServiceAsync(identifier);
        if (!result.Success)
        {
            if (result.AmbiguousMatches != null)
                return BadRequest(new { error = result.Error, matches = result.AmbiguousMatches });
            return NotFound(result.Error);
        }

        var service = await _dbContext.Services.FindAsync(result.Value);
        if (service == null) return NotFound("Service not found.");

        // Store name and file path with variables (no resolution here)
        var serviceFile = new ServiceFile
        {
            Id = Guid.NewGuid(),
            ServiceId = result.Value,
            Name = request.Name,
            FilePath = request.FilePath,
            CreatedAt = DateTime.UtcNow,
            ModifiedAt = DateTime.UtcNow
        };

        _dbContext.ServiceFiles.Add(serviceFile);
        await _dbContext.SaveChangesAsync();

        return Ok(serviceFile);
    }

    [HttpGet("{identifier}/files")]
    public async Task<IActionResult> ListFiles(string identifier)
    {
        var result = await _resolver.ResolveServiceAsync(identifier);
        if (!result.Success)
        {
            if (result.AmbiguousMatches != null)
                return BadRequest(new { error = result.Error, matches = result.AmbiguousMatches });
            return NotFound(result.Error);
        }

        var files = await _dbContext.ServiceFiles
            .Where(f => f.ServiceId == result.Value)
            .ToListAsync();

        var variableResolver = await GetActiveVariableResolver();

        var fileList = new List<object>();
        foreach (var file in files)
        {
            string resolvedName = file.Name;
            string resolvedPath = file.FilePath;
            if (variableResolver != null)
            {
                resolvedName = file.Name;
                resolvedPath = file.FilePath;
            }
            fileList.Add(new
            {
                file.Id,
                file.ServiceId,
                Name = resolvedName,
                FilePath = resolvedPath,
                file.CreatedAt,
                file.ModifiedAt
            });
        }

        return Ok(fileList);
    }

    [HttpPut("{identifier}/files/{fileId}")]
    public async Task<IActionResult> EditFile(string identifier, Guid fileId, [FromBody] EditFileRequest request)
    {
        var result = await _resolver.ResolveServiceAsync(identifier);
        if (!result.Success)
        {
            if (result.AmbiguousMatches != null)
                return BadRequest(new { error = result.Error, matches = result.AmbiguousMatches });
            return NotFound(result.Error);
        }

        var serviceFile = await _dbContext.ServiceFiles
            .FirstOrDefaultAsync(f => f.Id == fileId && f.ServiceId == result.Value);

        if (serviceFile == null) return NotFound("File not found.");

        var variableResolver = await GetActiveVariableResolver();
        var resolvedFilePath = serviceFile.FilePath;
        if (variableResolver != null)
            resolvedFilePath = (await variableResolver.ResolveVariablesAsync(serviceFile.FilePath)).Result;

        System.IO.File.WriteAllText(resolvedFilePath, request.Content);

        serviceFile.ModifiedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        return Ok();
    }

    [HttpGet("{identifier}/files/{fileId}/content")]
    public async Task<IActionResult> GetFileContent(string identifier, Guid fileId)
    {
        var result = await _resolver.ResolveServiceAsync(identifier);
        if (!result.Success)
        {
            if (result.AmbiguousMatches != null)
                return BadRequest(new { error = result.Error, matches = result.AmbiguousMatches });
            return NotFound(result.Error);
        }

        var serviceFile = await _dbContext.ServiceFiles
            .FirstOrDefaultAsync(f => f.Id == fileId && f.ServiceId == result.Value);

        if (serviceFile == null)
            return NotFound("File not found.");

        var variableResolver = await GetActiveVariableResolver();
        var resolvedFilePath = serviceFile.FilePath;
        if (variableResolver != null)
            resolvedFilePath = (await variableResolver.ResolveVariablesAsync(serviceFile.FilePath)).Result;

        if (!System.IO.File.Exists(resolvedFilePath))
            return NotFound("Resolved file does not exist.");

        try
        {
            string content = await System.IO.File.ReadAllTextAsync(resolvedFilePath);

            // Return in the format expected by the frontend
            return Ok(new
            {
                content = content,
                encoding = "utf8"  // Default to UTF8 for text files
            });
        }
        catch (Exception) when (IsBinaryFile(resolvedFilePath))
        {
            // If it's a binary file that can't be read as text, return as base64
            byte[] bytes = await System.IO.File.ReadAllBytesAsync(resolvedFilePath);
            string base64Content = Convert.ToBase64String(bytes);

            return Ok(new
            {
                content = base64Content,
                encoding = "base64"
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Error reading file: {ex.Message}");
        }
    }

    // Helper method to check if a file is likely binary
    private bool IsBinaryFile(string filePath)
    {
        var extension = Path.GetExtension(filePath).ToLowerInvariant();
        var binaryExtensions = new[] { ".exe", ".dll", ".png", ".jpg", ".jpeg", ".gif", ".pdf", ".zip", ".docx", ".xlsx" };

        return binaryExtensions.Contains(extension);
    }

    [HttpGet("{identifier}/files/{fileId}/download")]
    public async Task<IActionResult> DownloadFile(string identifier, Guid fileId)
    {
        var result = await _resolver.ResolveServiceAsync(identifier);
        if (!result.Success)
        {
            if (result.AmbiguousMatches != null)
                return BadRequest(new { error = result.Error, matches = result.AmbiguousMatches });
            return NotFound(result.Error);
        }

        var fileData = await LoadFileData(result.Value, fileId);

        if (fileData == null)
            return NotFound("File not found.");
        else 
            return File(fileData.Value.fileBytes, "application/octet-stream", fileData.Value.fileName);
    }

    private async Task<(String fileName, byte[] fileBytes)?> LoadFileData(Guid serviceId, Guid fileId)
    {
        var serviceFile = await _dbContext.ServiceFiles
                    .FirstOrDefaultAsync(f => f.Id == fileId && f.ServiceId == serviceId);

        if (serviceFile == null) return null;

        var variableResolver = await GetActiveVariableResolver();
        var resolvedFilePath = serviceFile.FilePath;
        var resolvedName = serviceFile.Name;
        if (variableResolver != null)
        {
            resolvedFilePath = (await variableResolver.ResolveVariablesAsync(serviceFile.FilePath)).Result;
            resolvedName = (await variableResolver.ResolveVariablesAsync(serviceFile.Name)).Result;
        }

        return (
            Path.GetFileName(resolvedName),
            await System.IO.File.ReadAllBytesAsync(resolvedFilePath));
    }

    [HttpDelete("{identifier}/files/{fileId}")]
    public async Task<IActionResult> DeleteFile(string identifier, Guid fileId)
    {
        var result = await _resolver.ResolveServiceAsync(identifier);
        if (!result.Success)
        {
            if (result.AmbiguousMatches != null)
                return BadRequest(new { error = result.Error, matches = result.AmbiguousMatches });
            return NotFound(result.Error);
        }

        var serviceFile = await _dbContext.ServiceFiles
            .FirstOrDefaultAsync(f => f.Id == fileId && f.ServiceId == result.Value);

        if (serviceFile == null)
            return NotFound("File not found.");

        _dbContext.ServiceFiles.Remove(serviceFile);
        await _dbContext.SaveChangesAsync();

        return NoContent();
    }
}

public class EditFileRequest
{
    public required string Content { get; set; }
}


public class AttachFileRequest
{
    public required string Name { get; set; }
    public required string FilePath { get; set; }
}
