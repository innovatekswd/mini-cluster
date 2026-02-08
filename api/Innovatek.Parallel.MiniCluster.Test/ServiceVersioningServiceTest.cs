using FluentAssertions;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Dtos;
using Innovatek.Parallel.MiniCluster.Api.Services;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;

namespace Innovatek.Parallel.MiniCluster.Test;

public class ServiceVersioningServiceTest
{
    private DbContextOptions<AppDbContext> CreateDbOptions()
    {
        return new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
    }

    private ServiceVersioningService CreateService(AppDbContext context)
    {
        var mockProcessManager = new Mock<IServiceProcessManager>();
        var mockLogger = new Mock<ILogger<ServiceVersioningService>>();
        return new ServiceVersioningService(context, mockProcessManager.Object, mockLogger.Object);
    }

    private (Guid appId, Guid serviceId) SeedAppAndService(AppDbContext context)
    {
        var appId = Guid.NewGuid();
        var serviceId = Guid.NewGuid();
        context.Apps.Add(new App { Id = appId, Name = "TestApp", Slug = "testapp" });
        context.Services.Add(new Service
        {
            Id = serviceId,
            Name = "TestService",
            Slug = "test-service",
            AppId = appId,
            ExecutablePath = "/usr/bin/dotnet",
            Arguments = "run",
            WorkingDirectory = "/app"
        });
        context.SaveChanges();
        return (appId, serviceId);
    }

    // ─── CreateVersionAsync ──────────────────────────────────

    [Fact]
    public async Task CreateVersionAsync_ValidService_CreatesVersion()
    {
        var options = CreateDbOptions();
        Guid serviceId;

        using (var context = new AppDbContext(options))
        {
            (_, serviceId) = SeedAppAndService(context);
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var dto = new CreateVersionDto { Version = "1.0.0", Label = "Initial", Source = VersionSource.Manual };

            var result = await service.CreateVersionAsync(serviceId, dto, CancellationToken.None);

            result.Should().NotBeNull();
            result.Version.Should().Be("1.0.0");
            result.Label.Should().Be("Initial");
            result.SequenceNumber.Should().Be(1);
            result.DeploymentStatus.Should().Be(DeploymentStatus.Active);
        }
    }

    [Fact]
    public async Task CreateVersionAsync_NonExistentService_ThrowsKeyNotFound()
    {
        var options = CreateDbOptions();
        using var context = new AppDbContext(options);
        var service = CreateService(context);

        var dto = new CreateVersionDto { Version = "1.0.0" };
        var act = () => service.CreateVersionAsync(Guid.NewGuid(), dto, CancellationToken.None);

        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task CreateVersionAsync_AutoIncrementsSequenceNumber()
    {
        var options = CreateDbOptions();
        Guid serviceId;

        using (var context = new AppDbContext(options))
        {
            (_, serviceId) = SeedAppAndService(context);
        }

        // Create first version
        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            await service.CreateVersionAsync(serviceId,
                new CreateVersionDto { Version = "1.0.0" }, CancellationToken.None);
        }

        // Create second version
        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var result = await service.CreateVersionAsync(serviceId,
                new CreateVersionDto { Version = "1.1.0" }, CancellationToken.None);

            result.SequenceNumber.Should().Be(2);
        }
    }

    [Fact]
    public async Task CreateVersionAsync_SnapshotsServiceConfig()
    {
        var options = CreateDbOptions();
        Guid serviceId;

        using (var context = new AppDbContext(options))
        {
            (_, serviceId) = SeedAppAndService(context);
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            await service.CreateVersionAsync(serviceId,
                new CreateVersionDto { Version = "1.0.0" }, CancellationToken.None);
        }

        // Verify config snapshot was stored
        using (var context = new AppDbContext(options))
        {
            var version = await context.ServiceVersions
                .FirstOrDefaultAsync(v => v.ServiceId == serviceId);

            version.Should().NotBeNull();
            version!.ConfigSnapshot.Should().NotBeNullOrEmpty();
            version.ConfigSnapshot.Should().Contain("dotnet"); // ExecutablePath
        }
    }

    // ─── GetVersionsAsync ────────────────────────────────────

    [Fact]
    public async Task GetVersionsAsync_ReturnsVersionsInDescOrder()
    {
        var options = CreateDbOptions();
        Guid serviceId;

        using (var context = new AppDbContext(options))
        {
            (_, serviceId) = SeedAppAndService(context);
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            await service.CreateVersionAsync(serviceId,
                new CreateVersionDto { Version = "1.0.0" }, CancellationToken.None);
            await service.CreateVersionAsync(serviceId,
                new CreateVersionDto { Version = "2.0.0" }, CancellationToken.None);
            await service.CreateVersionAsync(serviceId,
                new CreateVersionDto { Version = "3.0.0" }, CancellationToken.None);
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var versions = await service.GetVersionsAsync(serviceId, 10, CancellationToken.None);

            versions.Should().HaveCount(3);
            versions[0].SequenceNumber.Should().BeGreaterThanOrEqualTo(versions[1].SequenceNumber);
        }
    }

    [Fact]
    public async Task GetVersionsAsync_RespectsLimit()
    {
        var options = CreateDbOptions();
        Guid serviceId;

        using (var context = new AppDbContext(options))
        {
            (_, serviceId) = SeedAppAndService(context);
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            for (int i = 1; i <= 5; i++)
            {
                await service.CreateVersionAsync(serviceId,
                    new CreateVersionDto { Version = $"{i}.0.0" }, CancellationToken.None);
            }
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var versions = await service.GetVersionsAsync(serviceId, 3, CancellationToken.None);

            versions.Should().HaveCount(3);
        }
    }

    [Fact]
    public async Task GetVersionsAsync_EmptyForNoVersions()
    {
        var options = CreateDbOptions();
        Guid serviceId;

        using (var context = new AppDbContext(options))
        {
            (_, serviceId) = SeedAppAndService(context);
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var versions = await service.GetVersionsAsync(serviceId, 10, CancellationToken.None);

            versions.Should().BeEmpty();
        }
    }

    // ─── GetVersionAsync ─────────────────────────────────────

    [Fact]
    public async Task GetVersionAsync_ExistingVersion_ReturnsIt()
    {
        var options = CreateDbOptions();
        Guid serviceId;
        int versionId;

        using (var context = new AppDbContext(options))
        {
            (_, serviceId) = SeedAppAndService(context);
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var created = await service.CreateVersionAsync(serviceId,
                new CreateVersionDto { Version = "1.0.0", Label = "Test" }, CancellationToken.None);
            versionId = created.Id;
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var result = await service.GetVersionAsync(versionId, CancellationToken.None);

            result.Should().NotBeNull();
            result!.Version.Should().Be("1.0.0");
            result.Label.Should().Be("Test");
        }
    }

    [Fact]
    public async Task GetVersionAsync_NonExistent_ReturnsNull()
    {
        var options = CreateDbOptions();
        using var context = new AppDbContext(options);
        var service = CreateService(context);

        var result = await service.GetVersionAsync(99999, CancellationToken.None);

        result.Should().BeNull();
    }

    // ─── DeploymentConfig ────────────────────────────────────

    [Fact]
    public async Task GetDeploymentConfigAsync_NonExistent_ReturnsNull()
    {
        var options = CreateDbOptions();
        Guid serviceId;

        using (var context = new AppDbContext(options))
        {
            (_, serviceId) = SeedAppAndService(context);
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var result = await service.GetDeploymentConfigAsync(serviceId, CancellationToken.None);

            result.Should().BeNull();
        }
    }

    [Fact]
    public async Task UpdateDeploymentConfigAsync_CreatesIfNotExists()
    {
        var options = CreateDbOptions();
        Guid serviceId;

        using (var context = new AppDbContext(options))
        {
            (_, serviceId) = SeedAppAndService(context);
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var dto = new UpdateDeploymentConfigDto
            {
                MaxVersionsToKeep = 5,
                AutoVersionOnSave = true
            };

            var result = await service.UpdateDeploymentConfigAsync(serviceId, dto, CancellationToken.None);

            result.Should().NotBeNull();
            result.MaxVersionsToKeep.Should().Be(5);
            result.AutoVersionOnSave.Should().BeTrue();
        }
    }

    [Fact]
    public async Task UpdateDeploymentConfigAsync_UpdatesExisting()
    {
        var options = CreateDbOptions();
        Guid serviceId;

        using (var context = new AppDbContext(options))
        {
            (_, serviceId) = SeedAppAndService(context);
            context.DeploymentConfigs.Add(new DeploymentConfig
            {
                ServiceId = serviceId,
                MaxVersionsToKeep = 10,
                AutoVersionOnSave = false
            });
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var dto = new UpdateDeploymentConfigDto { AutoVersionOnSave = true };

            var result = await service.UpdateDeploymentConfigAsync(serviceId, dto, CancellationToken.None);

            result.AutoVersionOnSave.Should().BeTrue();
            result.MaxVersionsToKeep.Should().Be(10); // Unchanged
        }
    }

    // ─── AutoVersionOnSaveAsync ──────────────────────────────

    [Fact]
    public async Task AutoVersionOnSaveAsync_WhenDisabled_DoesNotCreateVersion()
    {
        var options = CreateDbOptions();
        Guid serviceId;

        using (var context = new AppDbContext(options))
        {
            (_, serviceId) = SeedAppAndService(context);
            context.DeploymentConfigs.Add(new DeploymentConfig
            {
                ServiceId = serviceId,
                AutoVersionOnSave = false
            });
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            await service.AutoVersionOnSaveAsync(serviceId, CancellationToken.None);
        }

        using (var context = new AppDbContext(options))
        {
            var versions = await context.ServiceVersions
                .Where(v => v.ServiceId == serviceId)
                .ToListAsync();
            versions.Should().BeEmpty();
        }
    }

    [Fact]
    public async Task AutoVersionOnSaveAsync_WhenEnabled_CreatesConfigChangeVersion()
    {
        var options = CreateDbOptions();
        Guid serviceId;

        using (var context = new AppDbContext(options))
        {
            (_, serviceId) = SeedAppAndService(context);
            context.DeploymentConfigs.Add(new DeploymentConfig
            {
                ServiceId = serviceId,
                AutoVersionOnSave = true
            });
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            await service.AutoVersionOnSaveAsync(serviceId, CancellationToken.None);
        }

        using (var context = new AppDbContext(options))
        {
            var versions = await context.ServiceVersions
                .Where(v => v.ServiceId == serviceId)
                .ToListAsync();
            versions.Should().HaveCount(1);
            versions[0].Source.Should().Be(VersionSource.ConfigChange);
        }
    }

    // ─── AppSnapshot ─────────────────────────────────────────

    [Fact]
    public async Task CreateAppSnapshotAsync_CapturesActiveVersions()
    {
        var options = CreateDbOptions();
        Guid appId, serviceId;

        using (var context = new AppDbContext(options))
        {
            (appId, serviceId) = SeedAppAndService(context);
        }

        // Create an active version
        using (var context = new AppDbContext(options))
        {
            context.ServiceVersions.Add(new ServiceVersion
            {
                ServiceId = serviceId,
                Version = "1.0.0",
                SequenceNumber = 1,
                DeploymentStatus = DeploymentStatus.Active,
                ConfigSnapshot = "{}",
                CreatedAt = DateTime.UtcNow
            });
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var dto = new CreateAppSnapshotDto { Version = "snap-1.0", Label = "Stable" };

            var result = await service.CreateAppSnapshotAsync(appId, dto, null, CancellationToken.None);

            result.Should().NotBeNull();
            result.Version.Should().Be("snap-1.0");
            result.Label.Should().Be("Stable");
            result.Entries.Should().HaveCount(1);
            result.Entries[0].ServiceId.Should().Be(serviceId);
        }
    }

    [Fact]
    public async Task GetAppSnapshotsAsync_ReturnsSnapshots()
    {
        var options = CreateDbOptions();
        Guid appId;

        using (var context = new AppDbContext(options))
        {
            (appId, _) = SeedAppAndService(context);
            context.AppSnapshots.Add(new AppSnapshot
            {
                AppId = appId,
                Version = "1.0",
                CreatedAt = DateTime.UtcNow
            });
            context.AppSnapshots.Add(new AppSnapshot
            {
                AppId = appId,
                Version = "2.0",
                CreatedAt = DateTime.UtcNow
            });
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var snapshots = await service.GetAppSnapshotsAsync(appId, 10, CancellationToken.None);

            snapshots.Should().HaveCount(2);
        }
    }

    [Fact]
    public async Task GetAppSnapshotAsync_NonExistent_ReturnsNull()
    {
        var options = CreateDbOptions();
        using var context = new AppDbContext(options);
        var service = CreateService(context);

        var result = await service.GetAppSnapshotAsync(99999, CancellationToken.None);

        result.Should().BeNull();
    }
}
