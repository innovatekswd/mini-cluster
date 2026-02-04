using AutoMapper;
using Innovatek.Parallel.MiniCluster.Core.Entities;

namespace Innovatek.Parallel.MiniCluster.Api.Dtos
{
    [AutoMap(typeof(VariableGroup))]
    public class CreateVariableGroupDto
    {
        public required string Name { get; set; }
        public string? Description { get; set; }
        public bool IsActive { get; set; }

        public virtual Dictionary<string, string> Variables { get; set; } = new();
    }


    [AutoMap(typeof(VariableGroup))]
    public class UpdateVariableGroupDto : CreateVariableGroupDto
    {
    }

    [AutoMap(typeof(VariableGroup))]

    public class VariableGroupDto
    {
        public Guid Id { get; set; }
        public required string Name { get; set; }
        public string? Description { get; set; }
        public bool IsActive { get; set; }

        public virtual Dictionary<string, string> Variables { get; set; } = new();
    }
}
