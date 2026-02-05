using Innovatek.Parallel.MiniCluster.Core.Entities;

public interface IEnvironmentService
{
    Task<Environment?> GetActiveEnvironmentAsync();
}
