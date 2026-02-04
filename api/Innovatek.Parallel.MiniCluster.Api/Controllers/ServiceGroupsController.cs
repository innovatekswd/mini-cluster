using AutoMapper;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Dtos;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Innovatek.Parallel.MiniCluster.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/groups")]
public class ServiceGroupsController : ControllerBase
{
    private readonly AppDbContext _dbContext;
    private readonly IMapper _mapper;
    private readonly ILogger<ServiceGroupsController> _logger;

    public ServiceGroupsController(AppDbContext dbContext, IMapper mapper, ILogger<ServiceGroupsController> logger)
    {
        _dbContext = dbContext;
        _mapper = mapper;
        _logger = logger;
    }

    /// <summary>
    /// Get all groups (flat list)
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<ServiceGroupDto>>> GetAll()
    {
        var groups = await _dbContext.ServiceGroups
            .Include(g => g.ServiceAssignments)
            .OrderBy(g => g.OrderIndex)
            .ThenBy(g => g.Name)
            .ToListAsync();

        return groups.Select(g => new ServiceGroupDto
        {
            Id = g.Id,
            Name = g.Name,
            Description = g.Description,
            Icon = g.Icon,
            Color = g.Color,
            ParentGroupId = g.ParentGroupId,
            OrderIndex = g.OrderIndex,
            CreatedAt = g.CreatedAt,
            ModifiedAt = g.ModifiedAt,
            ServiceCount = g.ServiceAssignments.Count
        }).ToList();
    }

    /// <summary>
    /// Get groups as a tree structure
    /// </summary>
    [HttpGet("tree")]
    public async Task<ActionResult<List<ServiceGroupDto>>> GetTree()
    {
        var allGroups = await _dbContext.ServiceGroups
            .Include(g => g.ServiceAssignments)
            .Include(g => g.ChildGroups)
            .OrderBy(g => g.OrderIndex)
            .ThenBy(g => g.Name)
            .ToListAsync();

        // Build tree starting from root groups
        var rootGroups = allGroups.Where(g => g.ParentGroupId == null).ToList();
        
        return rootGroups.Select(g => BuildGroupTree(g, allGroups)).ToList();
    }

    private ServiceGroupDto BuildGroupTree(ServiceGroup group, List<ServiceGroup> allGroups)
    {
        var children = allGroups.Where(g => g.ParentGroupId == group.Id).ToList();
        
        return new ServiceGroupDto
        {
            Id = group.Id,
            Name = group.Name,
            Description = group.Description,
            Icon = group.Icon,
            Color = group.Color,
            ParentGroupId = group.ParentGroupId,
            OrderIndex = group.OrderIndex,
            CreatedAt = group.CreatedAt,
            ModifiedAt = group.ModifiedAt,
            ServiceCount = group.ServiceAssignments.Count,
            ChildGroups = children.Select(c => BuildGroupTree(c, allGroups)).ToList()
        };
    }

    /// <summary>
    /// Get a specific group by ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<ServiceGroupDto>> GetById(Guid id)
    {
        var group = await _dbContext.ServiceGroups
            .Include(g => g.ServiceAssignments)
            .FirstOrDefaultAsync(g => g.Id == id);

        if (group == null)
            return NotFound();

        return new ServiceGroupDto
        {
            Id = group.Id,
            Name = group.Name,
            Description = group.Description,
            Icon = group.Icon,
            Color = group.Color,
            ParentGroupId = group.ParentGroupId,
            OrderIndex = group.OrderIndex,
            CreatedAt = group.CreatedAt,
            ModifiedAt = group.ModifiedAt,
            ServiceCount = group.ServiceAssignments.Count
        };
    }

    /// <summary>
    /// Create a new group
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ServiceGroupDto>> Create(CreateServiceGroupDto dto)
    {
        // Check for duplicate name
        var exists = await _dbContext.ServiceGroups.AnyAsync(g => g.Name == dto.Name);
        if (exists)
            return BadRequest($"A group with name '{dto.Name}' already exists.");

        // Validate parent group if specified
        if (dto.ParentGroupId.HasValue)
        {
            var parentExists = await _dbContext.ServiceGroups.AnyAsync(g => g.Id == dto.ParentGroupId.Value);
            if (!parentExists)
                return BadRequest($"Parent group with ID '{dto.ParentGroupId}' not found.");
        }

        var group = new ServiceGroup
        {
            Id = Guid.NewGuid(),
            Name = dto.Name,
            Description = dto.Description,
            Icon = dto.Icon,
            Color = dto.Color,
            ParentGroupId = dto.ParentGroupId,
            OrderIndex = dto.OrderIndex,
            CreatedAt = DateTime.UtcNow,
            ModifiedAt = DateTime.UtcNow
        };

        _dbContext.ServiceGroups.Add(group);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Created group {Name} ({Id})", group.Name, group.Id);

        return CreatedAtAction(nameof(GetById), new { id = group.Id }, new ServiceGroupDto
        {
            Id = group.Id,
            Name = group.Name,
            Description = group.Description,
            Icon = group.Icon,
            Color = group.Color,
            ParentGroupId = group.ParentGroupId,
            OrderIndex = group.OrderIndex,
            CreatedAt = group.CreatedAt,
            ModifiedAt = group.ModifiedAt,
            ServiceCount = 0
        });
    }

    /// <summary>
    /// Update a group
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<ServiceGroupDto>> Update(Guid id, UpdateServiceGroupDto dto)
    {
        var group = await _dbContext.ServiceGroups
            .Include(g => g.ServiceAssignments)
            .FirstOrDefaultAsync(g => g.Id == id);

        if (group == null)
            return NotFound();

        // Check for duplicate name if changing
        if (dto.Name != null && dto.Name != group.Name)
        {
            var exists = await _dbContext.ServiceGroups.AnyAsync(g => g.Name == dto.Name && g.Id != id);
            if (exists)
                return BadRequest($"A group with name '{dto.Name}' already exists.");
        }

        // Validate parent group if changing
        if (dto.ParentGroupId.HasValue && dto.ParentGroupId.Value != group.ParentGroupId)
        {
            // Can't set self as parent
            if (dto.ParentGroupId.Value == id)
                return BadRequest("A group cannot be its own parent.");

            var parentExists = await _dbContext.ServiceGroups.AnyAsync(g => g.Id == dto.ParentGroupId.Value);
            if (!parentExists)
                return BadRequest($"Parent group with ID '{dto.ParentGroupId}' not found.");

            // Check for cycles
            if (await WouldCreateCycle(id, dto.ParentGroupId.Value))
                return BadRequest("This would create a circular reference in the group hierarchy.");
        }

        // Update fields
        if (dto.Name != null) group.Name = dto.Name;
        if (dto.Description != null) group.Description = dto.Description;
        if (dto.Icon != null) group.Icon = dto.Icon;
        if (dto.Color != null) group.Color = dto.Color;
        if (dto.ParentGroupId.HasValue) group.ParentGroupId = dto.ParentGroupId;
        if (dto.OrderIndex.HasValue) group.OrderIndex = dto.OrderIndex.Value;

        group.ModifiedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Updated group {Name} ({Id})", group.Name, group.Id);

        return new ServiceGroupDto
        {
            Id = group.Id,
            Name = group.Name,
            Description = group.Description,
            Icon = group.Icon,
            Color = group.Color,
            ParentGroupId = group.ParentGroupId,
            OrderIndex = group.OrderIndex,
            CreatedAt = group.CreatedAt,
            ModifiedAt = group.ModifiedAt,
            ServiceCount = group.ServiceAssignments.Count
        };
    }

    /// <summary>
    /// Delete a group
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var group = await _dbContext.ServiceGroups
            .Include(g => g.ChildGroups)
            .Include(g => g.ServiceAssignments)
            .FirstOrDefaultAsync(g => g.Id == id);

        if (group == null)
            return NotFound();

        // Don't delete if has children
        if (group.ChildGroups.Any())
            return BadRequest($"Cannot delete group '{group.Name}' because it has {group.ChildGroups.Count} child groups.");

        // Remove service assignments (they cascade, but log for clarity)
        if (group.ServiceAssignments.Any())
        {
            _logger.LogInformation("Removing {Count} service assignments from group {Name}", group.ServiceAssignments.Count, group.Name);
        }

        _dbContext.ServiceGroups.Remove(group);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Deleted group {Name} ({Id})", group.Name, group.Id);

        return NoContent();
    }

    /// <summary>
    /// Get services in a group
    /// </summary>
    [HttpGet("{id}/services")]
    public async Task<ActionResult<List<ServiceResponseDto>>> GetServices(Guid id)
    {
        var group = await _dbContext.ServiceGroups
            .Include(g => g.ServiceAssignments)
                .ThenInclude(a => a.Service)
            .FirstOrDefaultAsync(g => g.Id == id);

        if (group == null)
            return NotFound();

        var services = group.ServiceAssignments
            .Where(a => a.Service != null)
            .Select(a => _mapper.Map<ServiceResponseDto>(a.Service))
            .ToList();

        return services;
    }

    /// <summary>
    /// Add a service to a group
    /// </summary>
    [HttpPost("{groupId}/services/{serviceId}")]
    public async Task<IActionResult> AddService(Guid groupId, Guid serviceId)
    {
        var group = await _dbContext.ServiceGroups.FindAsync(groupId);
        if (group == null)
            return NotFound($"Group with ID '{groupId}' not found.");

        var service = await _dbContext.Services.FindAsync(serviceId);
        if (service == null)
            return NotFound($"Service with ID '{serviceId}' not found.");

        // Check if already assigned
        var exists = await _dbContext.ServiceGroupAssignments.AnyAsync(a => a.ServiceId == serviceId && a.GroupId == groupId);
        if (exists)
            return BadRequest("Service is already in this group.");

        var assignment = new ServiceGroupAssignment
        {
            ServiceId = serviceId,
            GroupId = groupId,
            AssignedAt = DateTime.UtcNow
        };

        _dbContext.ServiceGroupAssignments.Add(assignment);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Added service {ServiceName} to group {GroupName}", service.Name, group.Name);

        return Ok();
    }

    /// <summary>
    /// Remove a service from a group
    /// </summary>
    [HttpDelete("{groupId}/services/{serviceId}")]
    public async Task<IActionResult> RemoveService(Guid groupId, Guid serviceId)
    {
        var assignment = await _dbContext.ServiceGroupAssignments
            .FirstOrDefaultAsync(a => a.ServiceId == serviceId && a.GroupId == groupId);

        if (assignment == null)
            return NotFound("Service is not in this group.");

        _dbContext.ServiceGroupAssignments.Remove(assignment);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Removed service {ServiceId} from group {GroupId}", serviceId, groupId);

        return NoContent();
    }

    /// <summary>
    /// Get variables for a group
    /// </summary>
    [HttpGet("{id}/variables")]
    public async Task<ActionResult<List<GroupVariableDto>>> GetVariables(Guid id)
    {
        var group = await _dbContext.ServiceGroups.FindAsync(id);
        if (group == null)
            return NotFound();

        var variables = await _dbContext.GroupVariables
            .Where(v => v.GroupId == id)
            .Select(v => new GroupVariableDto
            {
                Id = v.Id,
                GroupId = v.GroupId,
                Key = v.Key,
                Value = v.IsSecret ? "********" : v.Value,
                IsSecret = v.IsSecret
            })
            .ToListAsync();

        return variables;
    }

    /// <summary>
    /// Set variables for a group (replace all)
    /// </summary>
    [HttpPut("{id}/variables")]
    public async Task<IActionResult> SetVariables(Guid id, List<CreateGroupVariableDto> variables)
    {
        var group = await _dbContext.ServiceGroups.FindAsync(id);
        if (group == null)
            return NotFound();

        // Remove existing variables
        var existingVars = await _dbContext.GroupVariables.Where(v => v.GroupId == id).ToListAsync();
        _dbContext.GroupVariables.RemoveRange(existingVars);

        // Add new variables
        foreach (var v in variables)
        {
            _dbContext.GroupVariables.Add(new GroupVariable
            {
                Id = Guid.NewGuid(),
                GroupId = id,
                Key = v.Key,
                Value = v.Value,
                IsSecret = v.IsSecret,
                CreatedAt = DateTime.UtcNow,
                ModifiedAt = DateTime.UtcNow
            });
        }

        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Updated {Count} variables for group {GroupId}", variables.Count, id);

        return Ok();
    }

    /// <summary>
    /// Add a single variable to a group
    /// </summary>
    [HttpPost("{id}/variables")]
    public async Task<ActionResult<GroupVariableDto>> AddVariable(Guid id, CreateGroupVariableDto dto)
    {
        var group = await _dbContext.ServiceGroups.FindAsync(id);
        if (group == null)
            return NotFound();

        // Check for duplicate key
        var exists = await _dbContext.GroupVariables.AnyAsync(v => v.GroupId == id && v.Key == dto.Key);
        if (exists)
            return BadRequest($"A variable with key '{dto.Key}' already exists in this group.");

        var variable = new GroupVariable
        {
            Id = Guid.NewGuid(),
            GroupId = id,
            Key = dto.Key,
            Value = dto.Value,
            IsSecret = dto.IsSecret,
            CreatedAt = DateTime.UtcNow,
            ModifiedAt = DateTime.UtcNow
        };

        _dbContext.GroupVariables.Add(variable);
        await _dbContext.SaveChangesAsync();

        return new GroupVariableDto
        {
            Id = variable.Id,
            GroupId = variable.GroupId,
            Key = variable.Key,
            Value = variable.IsSecret ? "********" : variable.Value,
            IsSecret = variable.IsSecret
        };
    }

    /// <summary>
    /// Delete a variable from a group
    /// </summary>
    [HttpDelete("{groupId}/variables/{variableId}")]
    public async Task<IActionResult> DeleteVariable(Guid groupId, Guid variableId)
    {
        var variable = await _dbContext.GroupVariables
            .FirstOrDefaultAsync(v => v.Id == variableId && v.GroupId == groupId);

        if (variable == null)
            return NotFound();

        _dbContext.GroupVariables.Remove(variable);
        await _dbContext.SaveChangesAsync();

        return NoContent();
    }

    private async Task<bool> WouldCreateCycle(Guid groupId, Guid newParentId)
    {
        var currentId = newParentId;
        var visited = new HashSet<Guid>();

        while (currentId != Guid.Empty)
        {
            if (currentId == groupId)
                return true;

            if (visited.Contains(currentId))
                return true;

            visited.Add(currentId);

            var parent = await _dbContext.ServiceGroups.FindAsync(currentId);
            if (parent?.ParentGroupId == null)
                break;

            currentId = parent.ParentGroupId.Value;
        }

        return false;
    }
}
