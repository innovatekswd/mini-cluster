using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.EntityFrameworkCore;

public class VariableGroupService : IVariableGroupService
{
    private readonly AppDbContext _dbContext;

    public VariableGroupService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<VariableGroup?> GetActiveVariableGroupAsync()
    {
        return await _dbContext.VariableGroups.FirstOrDefaultAsync(vg => vg.IsActive);
    }
}
