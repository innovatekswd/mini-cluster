using Innovatek.Parallel.MiniCluster.Core.Entities;

public interface IVariableGroupService
{
    Task<VariableGroup?> GetActiveVariableGroupAsync();
}
