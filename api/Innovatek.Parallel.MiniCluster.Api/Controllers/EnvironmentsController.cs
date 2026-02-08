using AutoMapper;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Dtos;
using Innovatek.Parallel.MiniCluster.Api.Helpers;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace Innovatek.Parallel.MiniCluster.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/envs")]
public class EnvironmentsController : ControllerBase
{
    private readonly AppDbContext _dbContext;
    private readonly IMapper _mapper;

    public EnvironmentsController(AppDbContext dbContext, IMapper mapper)
    {
        _dbContext = dbContext;
        _mapper = mapper;
    }

    [HttpGet]
    public async Task<ActionResult<List<EnvironmentDto>>> GetAll()
    {
        var result = await _dbContext.Environments.ToListAsync();

        var _result = _mapper.Map<List<EnvironmentDto>>(result);
        return _result;
    }

    [HttpPost]
    public async Task<ActionResult<EnvironmentDto>> Create(CreateEnvironmentDto env)
    {
        // Assign a unique name if the provided name is empty or null
        if (string.IsNullOrWhiteSpace(env.Name))
        {
            env.Name = await GenerateUniqueName();
        }

        // Check if the name is unique
        var existingEnv = await _dbContext.Environments
            .FirstOrDefaultAsync(e => e.Name == env.Name);

        if (existingEnv != null)
        {
            return BadRequest($"An environment with the name '{env.Name}' already exists. Please choose a unique name.");
        }

        // Generate unique slug
        var slug = SlugHelper.GenerateUniqueSlug(
            env.Name,
            slug => _dbContext.Environments.Any(e => e.Slug == slug)
        );

        // If this is the first environment or no active environment exists, make it active
        var hasActiveEnvironment = await _dbContext.Environments.AnyAsync(e => e.IsActive);
        var isFirstEnvironment = !await _dbContext.Environments.AnyAsync();
        var shouldBeActive = isFirstEnvironment || !hasActiveEnvironment || env.IsActive;

        // Map the DTO to the entity
        var _env = new Core.Entities.Environment
        {
            Id = Guid.NewGuid(),
            Name = env.Name,
            Slug = slug,
            Description = env.Description,
            Variables = env.Variables,
            IsActive = shouldBeActive
        };

        // Add the environment to the database
        _dbContext.Environments.Add(_env);
        await _dbContext.SaveChangesAsync();

        // Return the created environment
        return CreatedAtAction(nameof(GetAll), new { id = _env.Id }, _mapper.Map<EnvironmentDto>(_env));
    }

    [HttpGet("active")]
    [ResponseCache(Duration = 60, Location = ResponseCacheLocation.Client)]
    public async Task<ActionResult<EnvironmentDto>> GetActive()
    {
        var env = await _dbContext.Environments
            .FirstOrDefaultAsync(e => e.IsActive);

        // If no active environment, activate the first one available
        if (env == null)
        {
            env = await _dbContext.Environments.FirstOrDefaultAsync();
        }

        // If no environments exist at all, create a default empty one
        if (env == null)
        {
            env = new Core.Entities.Environment
            {
                Id = Guid.NewGuid(),
                Name = "Default",
                Slug = "default",
                Description = "Default environment",
                Variables = new Dictionary<string, string>(),
                IsActive = true
            };
            _dbContext.Environments.Add(env);
        }
        else if (!env.IsActive)
        {
            env.IsActive = true;
        }

        await _dbContext.SaveChangesAsync();

        return _mapper.Map<EnvironmentDto>(env);
    }

    [HttpGet("{name}")]
    public async Task<ActionResult<EnvironmentDto>> GetByName(string name)
    {
        var env = await _dbContext.Environments
            .FirstOrDefaultAsync(e => e.Name == name);
        
        if (env == null) return NotFound();
        
        return _mapper.Map<EnvironmentDto>(env);
    }

    [HttpPut("{name}")]
    public async Task<IActionResult> Update(string name, UpdateEnvironmentDto updatedEnv)
    {
        var existingEnv = await _dbContext.Environments
            .FirstOrDefaultAsync(e => e.Name == name);
        if (existingEnv == null) return NotFound();

        // Map the updated DTO to the existing entity
        _mapper.Map(updatedEnv, existingEnv);

        MarkVariablesAsModified(existingEnv);

        await _dbContext.SaveChangesAsync();

        return new OkObjectResult(_mapper.Map<EnvironmentDto>(existingEnv));
    }

    private void MarkVariablesAsModified(Innovatek.Parallel.MiniCluster.Core.Entities.Environment? existingEnv)
    {
        if (existingEnv != null)
        {
            _dbContext.Entry(existingEnv)
                        .Property(e => e.Variables).IsModified = true;
        }
    }

    [HttpDelete("{name}")]
    public async Task<IActionResult> Delete(string name)
    {
        var env = await _dbContext.Environments
            .FirstOrDefaultAsync(e => e.Name == name);
        if (env == null) return NotFound();

        _dbContext.Environments.Remove(env);
        await _dbContext.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("{name}/variables")]
    public async Task<ActionResult<Dictionary<string, string>>> GetVariables(string name)
    {
        var env = await _dbContext.Environments
            .FirstOrDefaultAsync(e => e.Name == name);
        if (env == null) return NotFound();

        return env.Variables;
    }

    [HttpPut("{name}/variables")]
    public async Task<IActionResult> UpdateVariables(string name, Dictionary<string, string> updatedVariables)
    {
        var env = await _dbContext.Environments
            .FirstOrDefaultAsync(e => e.Name == name);
        if (env == null) return NotFound();

        // Update the environment variables
        env.Variables = updatedVariables;

        await _dbContext.SaveChangesAsync();

        return NoContent();
    }

    [HttpPost("{name}/activate")]
    public async Task<ActionResult> Activate(string name)
    {
        // Find the environment to activate
        var envToActivate = await _dbContext.Environments
            .FirstOrDefaultAsync(e => e.Name == name);
        if (envToActivate == null) return NotFound();

        // Deactivate all other environments
        var allEnvs = await _dbContext.Environments.ToListAsync();
        foreach (var env in allEnvs)
        {
            env.IsActive = env.Name == name;
        }

        // Save changes to the database
        await _dbContext.SaveChangesAsync();

        return Ok();
    }

    private async Task<string> GenerateUniqueName()
    {
        int counter = 1;
        string baseName = "Environment";
        string uniqueName;

        do
        {
            uniqueName = $"{baseName}-{counter:D2}";
            counter++;
        } while (await _dbContext.Environments.AnyAsync(e => e.Name == uniqueName));

        return uniqueName;
    }
}
