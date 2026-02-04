using AutoMapper;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Dtos;
using Innovatek.Parallel.MiniCluster.Api.Services;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Text.Json;

namespace Innovatek.Parallel.MiniCluster.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/proxy-routes")]
public class ProxyRoutesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IMapper _mapper;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IProxyConfigNotifier _proxyConfigNotifier;
    private readonly ILogger<ProxyRoutesController> _logger;

    public ProxyRoutesController(
        AppDbContext db, 
        IMapper mapper, 
        IHttpClientFactory httpClientFactory,
        IProxyConfigNotifier proxyConfigNotifier,
        ILogger<ProxyRoutesController> logger)
    {
        _db = db;
        _mapper = mapper;
        _httpClientFactory = httpClientFactory;
        _proxyConfigNotifier = proxyConfigNotifier;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<List<ProxyRouteDto>>> GetAll()
    {
        var routes = await _db.ProxyRoutes.OrderBy(r => r.Name).ToListAsync();
        var settings = await GetProxySettingsInternal();
        var serverIp = GetServerIp(settings);

        return routes.Select(r => MapToDto(r, settings, serverIp)).ToList();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ProxyRouteDto>> GetById(int id)
    {
        var route = await _db.ProxyRoutes.FindAsync(id);
        if (route == null) return NotFound();

        var settings = await GetProxySettingsInternal();
        var serverIp = GetServerIp(settings);

        return MapToDto(route, settings, serverIp);
    }

    [HttpPost]
    public async Task<ActionResult<ProxyRouteDto>> Create(CreateProxyRouteDto dto)
    {
        // Validate uniqueness
        if (dto.EnablePathPrefix && !string.IsNullOrEmpty(dto.PathPrefix))
        {
            if (await _db.ProxyRoutes.AnyAsync(r => r.PathPrefix == dto.PathPrefix))
                return BadRequest($"Path prefix '{dto.PathPrefix}' is already in use");
        }

        if (dto.EnableSubdomain && !string.IsNullOrEmpty(dto.Subdomain))
        {
            if (await _db.ProxyRoutes.AnyAsync(r => r.Subdomain == dto.Subdomain))
                return BadRequest($"Subdomain '{dto.Subdomain}' is already in use");
        }

        if (dto.EnablePort && dto.ProxyPort.HasValue)
        {
            if (await _db.ProxyRoutes.AnyAsync(r => r.ProxyPort == dto.ProxyPort))
                return BadRequest($"Port {dto.ProxyPort} is already in use");
        }

        var route = _mapper.Map<ProxyRoute>(dto);
        route.CreatedAt = DateTime.UtcNow;

        _db.ProxyRoutes.Add(route);
        await _db.SaveChangesAsync();

        // Notify YARP to reload config
        _proxyConfigNotifier.NotifyConfigChanged();

        var settings = await GetProxySettingsInternal();
        var serverIp = GetServerIp(settings);

        return CreatedAtAction(nameof(GetById), new { id = route.Id }, MapToDto(route, settings, serverIp));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ProxyRouteDto>> Update(int id, CreateProxyRouteDto dto)
    {
        var route = await _db.ProxyRoutes.FindAsync(id);
        if (route == null) return NotFound();

        // Validate uniqueness (exclude current route)
        if (dto.EnablePathPrefix && !string.IsNullOrEmpty(dto.PathPrefix))
        {
            if (await _db.ProxyRoutes.AnyAsync(r => r.PathPrefix == dto.PathPrefix && r.Id != id))
                return BadRequest($"Path prefix '{dto.PathPrefix}' is already in use");
        }

        if (dto.EnableSubdomain && !string.IsNullOrEmpty(dto.Subdomain))
        {
            if (await _db.ProxyRoutes.AnyAsync(r => r.Subdomain == dto.Subdomain && r.Id != id))
                return BadRequest($"Subdomain '{dto.Subdomain}' is already in use");
        }

        if (dto.EnablePort && dto.ProxyPort.HasValue)
        {
            if (await _db.ProxyRoutes.AnyAsync(r => r.ProxyPort == dto.ProxyPort && r.Id != id))
                return BadRequest($"Port {dto.ProxyPort} is already in use");
        }

        // Update fields
        route.Name = dto.Name;
        route.Description = dto.Description;
        route.Icon = dto.Icon;
        route.TargetUrl = dto.TargetUrl;
        route.EnablePathPrefix = dto.EnablePathPrefix;
        route.PathPrefix = dto.PathPrefix;
        route.RewriteUrls = dto.RewriteUrls;
        route.RewriteWebSocket = dto.RewriteWebSocket;
        route.EnableSubdomain = dto.EnableSubdomain;
        route.Subdomain = dto.Subdomain;
        route.EnablePort = dto.EnablePort;
        route.ProxyPort = dto.ProxyPort;
        route.EnableIframe = dto.EnableIframe;
        route.StripXFrameOptions = dto.StripXFrameOptions;
        route.RequireAuth = dto.RequireAuth;
        route.AllowedRoles = dto.AllowedRoles != null ? string.Join(",", dto.AllowedRoles) : null;
        route.TimeoutSeconds = dto.TimeoutSeconds;
        route.PreserveHostHeader = dto.PreserveHostHeader;
        route.CustomHeaders = dto.CustomHeaders != null ? JsonSerializer.Serialize(dto.CustomHeaders) : null;
        route.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        // Notify YARP to reload config
        _proxyConfigNotifier.NotifyConfigChanged();

        var settings = await GetProxySettingsInternal();
        var serverIp = GetServerIp(settings);

        return MapToDto(route, settings, serverIp);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var route = await _db.ProxyRoutes.FindAsync(id);
        if (route == null) return NotFound();

        _db.ProxyRoutes.Remove(route);
        await _db.SaveChangesAsync();

        // Notify YARP to reload config
        _proxyConfigNotifier.NotifyConfigChanged();

        return NoContent();
    }

    [HttpPost("{id}/toggle")]
    public async Task<ActionResult<ProxyRouteDto>> Toggle(int id)
    {
        var route = await _db.ProxyRoutes.FindAsync(id);
        if (route == null) return NotFound();

        route.IsEnabled = !route.IsEnabled;
        route.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // Notify YARP to reload config
        _proxyConfigNotifier.NotifyConfigChanged();

        var settings = await GetProxySettingsInternal();
        var serverIp = GetServerIp(settings);

        return MapToDto(route, settings, serverIp);
    }

    [HttpPost("{id}/test")]
    public async Task<ActionResult<ProxyHealthCheckDto>> TestConnection(int id)
    {
        var route = await _db.ProxyRoutes.FindAsync(id);
        if (route == null) return NotFound();

        return await TestTargetConnection(route.TargetUrl);
    }

    [HttpPost("test-url")]
    public async Task<ActionResult<ProxyHealthCheckDto>> TestUrl([FromBody] TestUrlDto dto)
    {
        return await TestTargetConnection(dto.Url);
    }

    private async Task<ProxyHealthCheckDto> TestTargetConnection(string targetUrl)
    {
        var result = new ProxyHealthCheckDto();
        var sw = Stopwatch.StartNew();

        try
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(10);

            var response = await client.GetAsync(targetUrl);
            sw.Stop();

            result.IsHealthy = response.IsSuccessStatusCode;
            result.StatusCode = (int)response.StatusCode;
            result.ResponseTimeMs = sw.ElapsedMilliseconds;
            result.Message = response.IsSuccessStatusCode ? "Target is reachable" : $"Target returned {response.StatusCode}";
        }
        catch (Exception ex)
        {
            sw.Stop();
            result.IsHealthy = false;
            result.ResponseTimeMs = sw.ElapsedMilliseconds;
            result.Error = ex.Message;
            result.Message = "Connection failed";
        }

        return result;
    }

    // Helper methods
    private async Task<ProxySettings> GetProxySettingsInternal()
    {
        return await _db.ProxySettings.FirstOrDefaultAsync() ?? new ProxySettings();
    }

    private string GetServerIp(ProxySettings settings)
    {
        if (!string.IsNullOrEmpty(settings.ServerIp))
            return settings.ServerIp;

        return DetectServerIp();
    }

    private string DetectServerIp()
    {
        try
        {
            var host = Dns.GetHostEntry(Dns.GetHostName());
            foreach (var ip in host.AddressList)
            {
                if (ip.AddressFamily == AddressFamily.InterNetwork && !IPAddress.IsLoopback(ip))
                    return ip.ToString();
            }
        }
        catch { }
        return "127.0.0.1";
    }

    private ProxyRouteDto MapToDto(ProxyRoute route, ProxySettings settings, string serverIp)
    {
        var port = 5000; // TODO: Get actual port from config

        var dto = new ProxyRouteDto
        {
            Id = route.Id,
            Name = route.Name,
            Description = route.Description,
            Icon = route.Icon,
            TargetUrl = route.TargetUrl,
            RequireAuth = route.RequireAuth,
            AllowedRoles = route.AllowedRoles?.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList(),
            IsEnabled = route.IsEnabled,
            IsHealthy = route.IsHealthy,
            LastHealthCheck = route.LastHealthCheck,
            CreatedAt = route.CreatedAt,
            UpdatedAt = route.UpdatedAt,
            Urls = new ProxyUrlsDto()
        };

        // Path Prefix
        if (route.EnablePathPrefix && !string.IsNullOrEmpty(route.PathPrefix))
        {
            var url = $"http://{serverIp}:{port}/proxy/{route.PathPrefix}";
            dto.PathPrefix = new PathPrefixConfigDto
            {
                Enabled = true,
                Prefix = route.PathPrefix,
                RewriteUrls = route.RewriteUrls,
                RewriteWebSocket = route.RewriteWebSocket,
                Url = url
            };
            dto.Urls.PathPrefix = url;
        }

        // Subdomain
        if (route.EnableSubdomain && !string.IsNullOrEmpty(route.Subdomain))
        {
            var baseDomain = settings.BaseDomainType switch
            {
                "sslip.io" => $"{serverIp.Replace(".", "-")}.sslip.io",
                "custom" => settings.CustomBaseDomain ?? $"{serverIp}.nip.io",
                _ => $"{serverIp}.nip.io"
            };
            var url = $"http://{route.Subdomain}.{baseDomain}:{port}";
            dto.Subdomain = new SubdomainConfigDto
            {
                Enabled = true,
                Subdomain = route.Subdomain,
                Url = url
            };
            dto.Urls.Subdomain = url;
            dto.Urls.Recommended = "subdomain";
        }

        // Port
        if (route.EnablePort && route.ProxyPort.HasValue)
        {
            var url = $"http://{serverIp}:{route.ProxyPort}";
            dto.Port = new PortConfigDto
            {
                Enabled = true,
                Port = route.ProxyPort,
                Url = url
            };
            dto.Urls.Port = url;
        }

        // Iframe
        if (route.EnableIframe)
        {
            dto.Iframe = new IframeConfigDto
            {
                Enabled = true,
                StripXFrameOptions = route.StripXFrameOptions,
                EmbedUrl = $"/proxies/{route.Id}/embed"
            };
            dto.Urls.Iframe = dto.Iframe.EmbedUrl;
        }

        return dto;
    }
}

public class TestUrlDto
{
    public string Url { get; set; } = string.Empty;
}
