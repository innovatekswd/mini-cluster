using AutoMapper;
using Innovatek.Parallel.MiniCluster.Core.Entities;

namespace Innovatek.Parallel.MiniCluster.Api.Dtos
{
    [AutoMap(typeof(Environment))]
    public class CreateEnvironmentDto
    {
        public required string Name { get; set; }
        public string? Description { get; set; }
        public bool IsActive { get; set; }

        public virtual Dictionary<string, string> Variables { get; set; } = new();
    }


    [AutoMap(typeof(Environment))]
    public class UpdateEnvironmentDto : CreateEnvironmentDto
    {
    }

    [AutoMap(typeof(Environment))]

    public class EnvironmentDto
    {
        public Guid Id { get; set; }
        public required string Name { get; set; }
        public string? Description { get; set; }
        public bool IsActive { get; set; }

        public virtual Dictionary<string, string> Variables { get; set; } = new();
    }
}
