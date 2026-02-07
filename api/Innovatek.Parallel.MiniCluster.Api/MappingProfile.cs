using AutoMapper;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Innovatek.Parallel.MiniCluster.Api.Dtos;
using System.Text.Json;

// This class inherits from AutoMapper Profile class
public class MappingProfile : Profile
{
    public MappingProfile()
    {
        // Map ServiceBase to Service (for import/export scenarios)
        CreateMap<ServiceBase, Service>();
        
        // DTO mappings for services
        CreateMap<CreateServiceDto, Service>()
            .ForMember(dest => dest.RestartPolicy, opt => opt.MapFrom(src => (RestartPolicy)src.RestartPolicy))
            .ForMember(dest => dest.HealthCheckType, opt => opt.MapFrom(src => (HealthCheckType)src.HealthCheckType));
        CreateMap<UpdateServiceDto, Service>()
            .ForMember(dest => dest.RestartPolicy, opt => opt.MapFrom(src => src.RestartPolicy.HasValue ? (RestartPolicy)src.RestartPolicy.Value : RestartPolicy.Never))
            .ForMember(dest => dest.HealthCheckType, opt => opt.MapFrom(src => src.HealthCheckType.HasValue ? (HealthCheckType)src.HealthCheckType.Value : HealthCheckType.None))
            .ForAllMembers(opts => opts.Condition((src, dest, srcMember) => srcMember != null));
        CreateMap<Service, ServiceResponseDto>()
            .ForMember(dest => dest.RestartPolicy, opt => opt.MapFrom(src => (int)src.RestartPolicy))
            .ForMember(dest => dest.HealthCheckType, opt => opt.MapFrom(src => (int)src.HealthCheckType));

        // App mappings
        CreateMap<App, ApplicationDto>();
        CreateMap<CreateApplicationDto, App>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedAt, opt => opt.MapFrom(_ => DateTime.UtcNow))
            .ForMember(dest => dest.ModifiedAt, opt => opt.MapFrom(_ => DateTime.UtcNow))
            .ForMember(dest => dest.SortOrder, opt => opt.Ignore());
        CreateMap<UpdateApplicationDto, App>()
            .ForMember(dest => dest.ModifiedAt, opt => opt.MapFrom(_ => DateTime.UtcNow))
            .ForAllMembers(opts => opts.Condition((src, dest, srcMember) => srcMember != null));

        // Environment mappings
        CreateMap<Innovatek.Parallel.MiniCluster.Core.Entities.Environment, EnvironmentDto>();
        CreateMap<CreateEnvironmentDto, Innovatek.Parallel.MiniCluster.Core.Entities.Environment>();
        CreateMap<UpdateEnvironmentDto, Innovatek.Parallel.MiniCluster.Core.Entities.Environment>();

        // Proxy route mappings
        CreateMap<CreateProxyRouteDto, ProxyRoute>()
            .ForMember(dest => dest.AllowedRoles, opt => opt.MapFrom((src, dest) => JoinAllowedRoles(src.AllowedRoles)))
            .ForMember(dest => dest.CustomHeaders, opt => opt.MapFrom((src, dest) => SerializeCustomHeaders(src.CustomHeaders)));

        // ProxyRoute to ProxyRouteDto - manual mapping for nested structure
        CreateMap<ProxyRoute, ProxyRouteDto>()
            .ForMember(dest => dest.PathPrefix, opt => opt.MapFrom((src, dest) => MapPathPrefixConfig(src)))
            .ForMember(dest => dest.Subdomain, opt => opt.MapFrom((src, dest) => MapSubdomainConfig(src)))
            .ForMember(dest => dest.Port, opt => opt.MapFrom((src, dest) => MapPortConfig(src)))
            .ForMember(dest => dest.Iframe, opt => opt.MapFrom((src, dest) => MapIframeConfig(src)))
            .ForMember(dest => dest.AllowedRoles, opt => opt.MapFrom((src, dest) => MapAllowedRoles(src.AllowedRoles)))
            .ForMember(dest => dest.Urls, opt => opt.Ignore()); // URLs are generated in the controller

        CreateMap<ProxySettings, ProxySettingsDto>();
        CreateMap<UpdateProxySettingsDto, ProxySettings>();

        // Machine mappings
        CreateMap<Machine, MachineDto>()
            .ForMember(dest => dest.ServiceCount, opt => opt.Ignore())
            .ForMember(dest => dest.RunningServiceCount, opt => opt.Ignore());
        CreateMap<CreateMachineDto, Machine>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.Status, opt => opt.Ignore())
            .ForMember(dest => dest.LastSeen, opt => opt.Ignore())
            .ForMember(dest => dest.IsLocal, opt => opt.Ignore())
            .ForMember(dest => dest.Metadata, opt => opt.Ignore())
            .ForMember(dest => dest.AgentVersion, opt => opt.Ignore())
            .ForMember(dest => dest.CpuCores, opt => opt.Ignore())
            .ForMember(dest => dest.TotalMemoryBytes, opt => opt.Ignore())
            .ForMember(dest => dest.TotalDiskBytes, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedAt, opt => opt.MapFrom(_ => DateTime.UtcNow))
            .ForMember(dest => dest.ModifiedAt, opt => opt.MapFrom(_ => DateTime.UtcNow))
            .ForMember(dest => dest.Services, opt => opt.Ignore());
        CreateMap<UpdateMachineDto, Machine>()
            .ForMember(dest => dest.ModifiedAt, opt => opt.MapFrom(_ => DateTime.UtcNow))
            .ForAllMembers(opts => opts.Condition((src, dest, srcMember) => srcMember != null));

        // ── Post-MVP Mappings ──────────────────────────────────────

        // CronJob mappings
        CreateMap<CreateCronJobDto, CronJob>();
        CreateMap<CronJob, CronJobResponseDto>();
        CreateMap<CronJobRun, CronJobRunResponseDto>()
            .ForMember(dest => dest.Status, opt => opt.MapFrom(src => (int)src.Status));
    }

    private static PathPrefixConfigDto MapPathPrefixConfig(ProxyRoute src)
    {
        return new PathPrefixConfigDto
        {
            Enabled = src.EnablePathPrefix,
            Prefix = src.PathPrefix,
            RewriteUrls = src.RewriteUrls,
            RewriteWebSocket = src.RewriteWebSocket
        };
    }

    private static SubdomainConfigDto MapSubdomainConfig(ProxyRoute src)
    {
        return new SubdomainConfigDto
        {
            Enabled = src.EnableSubdomain,
            Subdomain = src.Subdomain
        };
    }

    private static PortConfigDto MapPortConfig(ProxyRoute src)
    {
        return new PortConfigDto
        {
            Enabled = src.EnablePort,
            Port = src.ProxyPort
        };
    }

    private static IframeConfigDto MapIframeConfig(ProxyRoute src)
    {
        return new IframeConfigDto
        {
            Enabled = src.EnableIframe,
            StripXFrameOptions = src.StripXFrameOptions
        };
    }

    private static List<string>? MapAllowedRoles(string? allowedRoles)
    {
        if (string.IsNullOrEmpty(allowedRoles))
            return null;
        
        return allowedRoles.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
    }

    private static string? JoinAllowedRoles(List<string>? allowedRoles)
    {
        if (allowedRoles == null || allowedRoles.Count == 0)
            return null;
        
        return string.Join(",", allowedRoles);
    }

    private static string? SerializeCustomHeaders(Dictionary<string, string>? customHeaders)
    {
        if (customHeaders == null || customHeaders.Count == 0)
            return null;
        
        return JsonSerializer.Serialize(customHeaders);
    }
}
