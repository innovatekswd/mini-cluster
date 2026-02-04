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
        CreateMap<CreateServiceDto, Service>();
        CreateMap<UpdateServiceDto, Service>()
            .ForAllMembers(opts => opts.Condition((src, dest, srcMember) => srcMember != null));
        CreateMap<Service, ServiceResponseDto>();

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

        // Variable group mappings
        CreateMap<VariableGroup, VariableGroupDto>();
        CreateMap<CreateVariableGroupDto, VariableGroup>();
        CreateMap<UpdateVariableGroupDto, VariableGroup>();

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
