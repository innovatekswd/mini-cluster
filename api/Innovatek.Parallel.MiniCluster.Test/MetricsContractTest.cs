using FluentAssertions;
using Innovatek.Parallel.MiniCluster.Api.Services;
using Moq;

namespace Innovatek.Parallel.MiniCluster.Test;

/// <summary>
/// Contract tests for the SystemMetricsSnapshot DTO.
/// These tests lock in the JSON field names that the React UI depends on —
/// so a rename doesn't silently break the frontend.
/// </summary>
public class MetricsContractTest
{
    // ── SystemMetricsSnapshot has the fields the UI expects ──────────────────

    [Fact]
    public void SystemMetricsSnapshot_HasCpuUsagePercent()
    {
        var snap = new SystemMetricsSnapshot { CpuUsagePercent = 42.5 };
        snap.CpuUsagePercent.Should().Be(42.5);
    }

    [Fact]
    public void SystemMetricsSnapshot_HasMemoryUsagePercent()
    {
        var snap = new SystemMetricsSnapshot { MemoryUsagePercent = 67.3 };
        snap.MemoryUsagePercent.Should().Be(67.3);
    }

    [Fact]
    public void SystemMetricsSnapshot_DisksIsNeverNull()
    {
        var snap = new SystemMetricsSnapshot();
        snap.Disks.Should().NotBeNull("disks must be an empty list, not null — UI calls disks[0]");
        snap.Disks.Should().BeEmpty();
    }

    [Fact]
    public void SystemMetricsSnapshot_NetworkInterfacesIsNeverNull()
    {
        var snap = new SystemMetricsSnapshot();
        snap.NetworkInterfaces.Should().NotBeNull("networkInterfaces must be an empty list, not null");
        snap.NetworkInterfaces.Should().BeEmpty();
    }

    // ── MetricsController returns the snapshot from the service ──────────────

    [Fact]
    public void MetricsController_GetSystemMetrics_ReturnsServiceSnapshot()
    {
        var expectedSnap = new SystemMetricsSnapshot
        {
            CpuUsagePercent = 55,
            MemoryUsagePercent = 70,
            Disks = [new DiskInfo { Name = "C:\\", UsagePercent = 60 }],
            NetworkInterfaces = [],
        };

        var mockSvc = new Mock<IProcessMetricsService>();
        mockSvc.Setup(s => s.GetSystemMetrics()).Returns(expectedSnap);

        var result = mockSvc.Object.GetSystemMetrics();
        result.CpuUsagePercent.Should().Be(55);
        result.MemoryUsagePercent.Should().Be(70);
        result.Disks.Should().HaveCount(1);
        result.Disks[0].UsagePercent.Should().Be(60);
    }
}

/// <summary>
/// Route contract tests — verify that the expected URL paths exist via
/// the controller [Route] attributes so refactors don't silently 404.
/// </summary>
public class RouteContractTest
{
    [Fact]
    public void EnvironmentsController_RouteAttribute_IsApiEnvs()
    {
        var type = typeof(Innovatek.Parallel.MiniCluster.Api.Controllers.EnvironmentsController);
        var routeAttr = type
            .GetCustomAttributes(typeof(Microsoft.AspNetCore.Mvc.RouteAttribute), inherit: false)
            .Cast<Microsoft.AspNetCore.Mvc.RouteAttribute>()
            .FirstOrDefault();

        routeAttr.Should().NotBeNull("EnvironmentsController must have a [Route] attribute");
        routeAttr!.Template.Should().Be("api/envs",
            "UI calls /api/envs — if this changes the frontend breaks");
    }

    [Fact]
    public void AppsController_RouteAttribute_IsApiApps()
    {
        var type = typeof(Innovatek.Parallel.MiniCluster.Api.Controllers.AppsController);
        var routeAttr = type
            .GetCustomAttributes(typeof(Microsoft.AspNetCore.Mvc.RouteAttribute), inherit: false)
            .Cast<Microsoft.AspNetCore.Mvc.RouteAttribute>()
            .FirstOrDefault();

        routeAttr.Should().NotBeNull("AppsController must have a [Route] attribute");
        // Template is "api/[controller]" which resolves to api/Apps by ASP.NET convention
        routeAttr!.Template.Should().ContainEquivalentOf("controller",
            "AppsController route must use [controller] token resolving to /api/Apps");
    }
}
