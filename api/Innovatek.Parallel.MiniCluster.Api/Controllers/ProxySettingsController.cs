using AutoMapper;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Dtos;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Net;
using System.Net.Sockets;

namespace Innovatek.Parallel.MiniCluster.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/proxy-settings")]
public class ProxySettingsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IMapper _mapper;

    public ProxySettingsController(AppDbContext db, IMapper mapper)
    {
        _db = db;
        _mapper = mapper;
    }

    [HttpGet]
    public async Task<ActionResult<ProxySettingsDto>> Get()
    {
        var settings = await _db.ProxySettings.FirstOrDefaultAsync() 
            ?? new ProxySettings { Id = 1 };

        var usedPorts = await _db.ProxyRoutes
            .Where(r => r.ProxyPort.HasValue)
            .Select(r => r.ProxyPort!.Value)
            .ToListAsync();

        var dto = _mapper.Map<ProxySettingsDto>(settings);
        dto.DetectedServerIp = DetectServerIp();
        dto.UsedPorts = usedPorts;

        return dto;
    }

    [HttpPut]
    public async Task<ActionResult<ProxySettingsDto>> Update(UpdateProxySettingsDto dto)
    {
        if (dto.PortRangeStart >= dto.PortRangeEnd)
            return BadRequest("Port range start must be less than end");

        var settings = await _db.ProxySettings.FirstOrDefaultAsync();
        if (settings == null)
        {
            settings = new ProxySettings { Id = 1 };
            _db.ProxySettings.Add(settings);
        }

        settings.BaseDomainType = dto.BaseDomainType;
        settings.CustomBaseDomain = dto.CustomBaseDomain;
        settings.PortRangeStart = dto.PortRangeStart;
        settings.PortRangeEnd = dto.PortRangeEnd;
        settings.DefaultRequireAuth = dto.DefaultRequireAuth;
        settings.ServerIp = dto.ServerIp;
        settings.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return await Get();
    }

    [HttpGet("server-ip")]
    public ActionResult<ServerIpDto> GetServerIp()
    {
        return new ServerIpDto
        {
            DetectedIp = DetectServerIp(),
            AllIps = GetAllIps()
        };
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

    private List<string> GetAllIps()
    {
        var ips = new List<string>();
        try
        {
            var host = Dns.GetHostEntry(Dns.GetHostName());
            foreach (var ip in host.AddressList)
            {
                if (ip.AddressFamily == AddressFamily.InterNetwork)
                    ips.Add(ip.ToString());
            }
        }
        catch { }
        return ips;
    }
}

public class ServerIpDto
{
    public string DetectedIp { get; set; } = string.Empty;
    public List<string> AllIps { get; set; } = new();
}
