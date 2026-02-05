using Innovatek.Parallel.MiniCluster.Core.Entities;

public interface IEnvironmentService
{
    Task<Innovatek.Parallel.MiniCluster.Core.Entities.Environment?> GetActiveEnvironmentAsync();
}
