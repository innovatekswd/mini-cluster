using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Dtos;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace Innovatek.Parallel.MiniCluster.Api.Services;

public interface IAppTreeService
{
    Task<List<AppTreeNodeDto>> GetAppTreeAsync(CancellationToken ct = default);
    Task<AppTreeNodeDto?> GetAppSubtreeAsync(Guid appId, CancellationToken ct = default);
    Task MoveAppAsync(Guid appId, MoveAppDto dto, CancellationToken ct = default);
    Task ReorderChildrenAsync(Guid parentAppId, ReorderChildrenDto dto, CancellationToken ct = default);
    Task StartAppTreeAsync(Guid appId, string requester, CancellationToken ct = default);
    Task StopAppTreeAsync(Guid appId, CancellationToken ct = default);
    Task RestartAppTreeAsync(Guid appId, string requester, CancellationToken ct = default);
}

public class AppTreeService : IAppTreeService
{
    private readonly AppDbContext _context;
    private readonly IServiceProcessManager _processManager;
    private readonly ILogger<AppTreeService> _logger;

    public AppTreeService(
        AppDbContext context,
        IServiceProcessManager processManager,
        ILogger<AppTreeService> logger)
    {
        _context = context;
        _processManager = processManager;
        _logger = logger;
    }

    public async Task<List<AppTreeNodeDto>> GetAppTreeAsync(CancellationToken ct = default)
    {
        var allApps = await _context.Apps
            .Include(a => a.Services)
            .OrderBy(a => a.SortOrder)
            .ThenBy(a => a.Name)
            .ToListAsync(ct);

        var rootApps = allApps.Where(a => a.ParentAppId == null).ToList();
        return rootApps.Select(a => BuildTreeNode(a, allApps)).ToList();
    }

    public async Task<AppTreeNodeDto?> GetAppSubtreeAsync(Guid appId, CancellationToken ct = default)
    {
        var allApps = await _context.Apps
            .Include(a => a.Services)
            .ToListAsync(ct);

        var app = allApps.FirstOrDefault(a => a.Id == appId);
        return app == null ? null : BuildTreeNode(app, allApps);
    }

    public async Task MoveAppAsync(Guid appId, MoveAppDto dto, CancellationToken ct = default)
    {
        var app = await _context.Apps.FindAsync(new object[] { appId }, ct)
            ?? throw new KeyNotFoundException($"App {appId} not found");

        // Validate target parent exists (if not moving to root)
        if (dto.NewParentAppId.HasValue)
        {
            var parent = await _context.Apps.FindAsync(new object[] { dto.NewParentAppId.Value }, ct)
                ?? throw new KeyNotFoundException($"Parent app {dto.NewParentAppId} not found");

            // Cycle detection: walk from target parent up to root, must not encounter appId
            if (await WouldCreateCycleAsync(appId, dto.NewParentAppId.Value, ct))
                throw new InvalidOperationException("Moving this app would create a cycle in the hierarchy");
        }

        app.ParentAppId = dto.NewParentAppId;
        app.ModifiedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);
        _logger.LogInformation("Moved app {AppId} to parent {ParentId}", appId, dto.NewParentAppId?.ToString() ?? "root");
    }

    public async Task ReorderChildrenAsync(Guid parentAppId, ReorderChildrenDto dto, CancellationToken ct = default)
    {
        var children = await _context.Apps
            .Where(a => a.ParentAppId == parentAppId)
            .ToListAsync(ct);

        for (int i = 0; i < dto.OrderedChildIds.Count; i++)
        {
            var child = children.FirstOrDefault(c => c.Id == dto.OrderedChildIds[i]);
            if (child != null)
            {
                child.SortOrder = i;
                child.ModifiedAt = DateTime.UtcNow;
            }
        }

        await _context.SaveChangesAsync(ct);
    }

    public async Task StartAppTreeAsync(Guid appId, string requester, CancellationToken ct = default)
    {
        var serviceIds = await CollectAllServiceIdsAsync(appId, ct);
        foreach (var sid in serviceIds)
        {
            try { await _processManager.StartServiceAsync(sid, requester); }
            catch (Exception ex) { _logger.LogWarning(ex, "Failed to start service {ServiceId} in app tree", sid); }
        }
    }

    public async Task StopAppTreeAsync(Guid appId, CancellationToken ct = default)
    {
        var serviceIds = await CollectAllServiceIdsAsync(appId, ct);
        foreach (var sid in serviceIds)
        {
            try { await _processManager.StopServiceAsync(sid); }
            catch (Exception ex) { _logger.LogWarning(ex, "Failed to stop service {ServiceId} in app tree", sid); }
        }
    }

    public async Task RestartAppTreeAsync(Guid appId, string requester, CancellationToken ct = default)
    {
        await StopAppTreeAsync(appId, ct);
        await Task.Delay(500, ct); // Brief pause between stop and start
        await StartAppTreeAsync(appId, requester, ct);
    }

    // ── Private helpers ────────────────────────────────────────

    private AppTreeNodeDto BuildTreeNode(App app, List<App> allApps)
    {
        var children = allApps
            .Where(a => a.ParentAppId == app.Id)
            .OrderBy(a => a.SortOrder)
            .ThenBy(a => a.Name)
            .ToList();

        return new AppTreeNodeDto
        {
            Id = app.Id,
            Name = app.Name,
            Slug = app.Slug,
            Icon = app.Icon,
            Color = app.Color,
            ParentAppId = app.ParentAppId,
            SortOrder = app.SortOrder,
            Services = app.Services?.Select(s => new ServiceSummaryDto
            {
                Id = s.Id,
                Name = s.Name,
                Status = _processManager.GetStatus(s.Id).ToString()
            }).ToList() ?? new(),
            Children = children.Select(c => BuildTreeNode(c, allApps)).ToList()
        };
    }

    private async Task<bool> WouldCreateCycleAsync(Guid movingAppId, Guid targetParentId, CancellationToken ct)
    {
        var current = targetParentId;
        var visited = new HashSet<Guid> { movingAppId };

        while (true)
        {
            if (visited.Contains(current))
                return true;

            visited.Add(current);

            var parent = await _context.Apps
                .Where(a => a.Id == current)
                .Select(a => a.ParentAppId)
                .FirstOrDefaultAsync(ct);

            if (parent == null)
                return false; // Reached root

            current = parent.Value;
        }
    }

    private async Task<List<Guid>> CollectAllServiceIdsAsync(Guid appId, CancellationToken ct)
    {
        var result = new List<Guid>();
        var queue = new Queue<Guid>();
        queue.Enqueue(appId);

        while (queue.Count > 0)
        {
            var currentAppId = queue.Dequeue();

            var serviceIds = await _context.Services
                .Where(s => s.AppId == currentAppId)
                .Select(s => s.Id)
                .ToListAsync(ct);
            result.AddRange(serviceIds);

            var childAppIds = await _context.Apps
                .Where(a => a.ParentAppId == currentAppId)
                .Select(a => a.Id)
                .ToListAsync(ct);
            foreach (var childId in childAppIds)
                queue.Enqueue(childId);
        }

        return result;
    }
}
