using AutoMapper;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Dtos;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace Innovatek.Parallel.MiniCluster.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/variables/groups")]
public class VariableGroupsController : ControllerBase
{
    private readonly AppDbContext _dbContext;
    private readonly IMapper _mapper;

    public VariableGroupsController(AppDbContext dbContext, IMapper mapper)
    {
        _dbContext = dbContext;
        _mapper = mapper;
    }

    [HttpGet]
    public async Task<ActionResult<List<VariableGroupDto>>> GetAll()
    {
        var result = await _dbContext.VariableGroups.ToListAsync();

        var _result = _mapper.Map<List<VariableGroupDto>>(result);
        return _result;
    }

    [HttpPost]
    public async Task<ActionResult<VariableGroupDto>> Create(CreateVariableGroupDto group)
    {
        // Assign a unique name if the provided name is empty or null
        if (string.IsNullOrWhiteSpace(group.Name))
        {
            group.Name = await GenerateUniqueName();
        }

        // Check if the name is unique
        var existingGroup = await _dbContext.VariableGroups
            .FirstOrDefaultAsync(vg => vg.Name == group.Name);

        if (existingGroup != null)
        {
            return BadRequest($"A variable group with the name '{group.Name}' already exists. Please choose a unique name.");
        }

        // Map the DTO to the entity
        var _group = _mapper.Map<VariableGroup>(group);
        _group.Id = Guid.NewGuid();

        // Add the group to the database
        _dbContext.VariableGroups.Add(_group);
        await _dbContext.SaveChangesAsync();

        // Return the created group
        return CreatedAtAction(nameof(GetAll), new { id = _group.Id }, _mapper.Map<VariableGroupDto>(_group));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, UpdateVariableGroupDto updatedGroup)
    {
        var existingGroup = await _dbContext.VariableGroups.FindAsync(id);
        if (existingGroup == null) return NotFound();

        // Map the updated DTO to the existing entity
        _mapper.Map(updatedGroup, existingGroup);

        MarkVariablesAsModified(existingGroup);

        await _dbContext.SaveChangesAsync();

        var result = await _dbContext.VariableGroups.FindAsync(id);


        return new OkObjectResult(result);
    }

    private void MarkVariablesAsModified(VariableGroup? existingGroup)
    {
        if (existingGroup != null)
        {
            _dbContext.Entry(existingGroup)
                        .Property(e => e.Variables).IsModified = true;
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var group = await _dbContext.VariableGroups.FindAsync(id);
        if (group == null) return NotFound();

        _dbContext.VariableGroups.Remove(group);
        await _dbContext.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("{groupId}/variables")]
    public async Task<ActionResult<Dictionary<string, string>>> GetVariables(Guid groupId)
    {
        var group = await _dbContext.VariableGroups.FindAsync(groupId);
        if (group == null) return NotFound();

        return group.Variables;
    }

    [HttpPut("{groupId}/variables")]
    public async Task<IActionResult> UpdateVariables(Guid groupId, Dictionary<string, string> updatedVariables)
    {
        var group = await _dbContext.VariableGroups.FindAsync(groupId);
        if (group == null) return NotFound();

        // Update the environment variables
        group.Variables = updatedVariables;

        await _dbContext.SaveChangesAsync();

        return NoContent();
    }

    [HttpPost("{groupId}/activate")]
    public async Task<ActionResult> Activate(Guid groupId)
    {
        // Find the group to activate
        var groupToActivate = await _dbContext.VariableGroups.FindAsync(groupId);
        if (groupToActivate == null) return NotFound();

        // Deactivate all other groups
        var allGroups = await _dbContext.VariableGroups.ToListAsync();
        foreach (var group in allGroups)
        {
            group.IsActive = group.Id == groupId;
        }

        // Save changes to the database
        await _dbContext.SaveChangesAsync();

        return Ok();
    }

    private async Task<string> GenerateUniqueName()
    {
        int counter = 1;
        string baseName = "VarGroup";
        string uniqueName;

        do
        {
            uniqueName = $"{baseName}-{counter:D2}";
            counter++;
        } while (await _dbContext.VariableGroups.AnyAsync(vg => vg.Name == uniqueName));

        return uniqueName;
    }
}
