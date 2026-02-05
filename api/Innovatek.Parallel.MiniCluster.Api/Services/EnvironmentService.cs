using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.EntityFrameworkCore;

public class EnvironmentService : IEnvironmentService
{
    private readonly AppDbContext _dbContext;

    public EnvironmentService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<Innovatek.Parallel.MiniCluster.Core.Entities.Environment?> GetActiveEnvironmentAsync()
    {
        return await _dbContext.Environments.FirstOrDefaultAsync(e => e.IsActive);
    }
}
