using AutoMapper;
using Innovatek.Parallel.MiniCluster.Core.Entities;

namespace Innovatek.Parallel.MiniCluster.Api.Dtos
{
    [AutoMap(typeof(Core.Entities.Environment))]
    public class CreateEnvironmentDto
    {
        public required string Name { get; set; }
        public string? Description { get; set; }
        public bool IsActive { get; set; }

        public virtual Dictionary<string, string> Variables { get; set; } = new();
    }


    [AutoMap(typeof(Core.Entities.Environment))]
    public class UpdateEnvironmentDto : CreateEnvironmentDto
    {
    }

    [AutoMap(typeof(Core.Entities.Environment))]

    public class EnvironmentDto
    {
        public Guid Id { get; set; }
        public required string Name { get; set; }
        public required string Slug { get; set; }
        public string? Description { get; set; }
        public bool IsActive { get; set; }

        public virtual Dictionary<string, string> Variables { get; set; } = new();
    }
}
