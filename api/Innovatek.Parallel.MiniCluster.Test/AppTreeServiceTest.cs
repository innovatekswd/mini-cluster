using FluentAssertions;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Services;
using Innovatek.Parallel.MiniCluster.Api.Dtos;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;

namespace Innovatek.Parallel.MiniCluster.Test;

public class AppTreeServiceTest
{
    private DbContextOptions<AppDbContext> CreateInMemoryDbContextOptions()
    {
        return new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
    }

    private AppTreeService CreateService(AppDbContext context)
    {
        var mockProcessManager = new Mock<IServiceProcessManager>();
        var mockLogger = new Mock<ILogger<AppTreeService>>();
        return new AppTreeService(context, mockProcessManager.Object, mockLogger.Object);
    }

    [Fact]
    public async Task GetAppTreeAsync_EmptyDb_ReturnsEmptyList()
    {
        var options = CreateInMemoryDbContextOptions();
        using var context = new AppDbContext(options);
        var service = CreateService(context);

        var result = await service.GetAppTreeAsync();

        result.Should().BeEmpty();
    }

    [Fact]
    public async Task GetAppTreeAsync_ReturnsRootAppsOnly()
    {
        var options = CreateInMemoryDbContextOptions();

        // Arrange
        using (var context = new AppDbContext(options))
        {
            var parent = new App { Id = Guid.NewGuid(), Name = "Parent", Slug = "parent" };
            var child = new App { Id = Guid.NewGuid(), Name = "Child", Slug = "child", ParentAppId = parent.Id };
            context.Apps.AddRange(parent, child);
            await context.SaveChangesAsync();
        }

        // Act
        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var result = await service.GetAppTreeAsync();

            // Assert — only root nodes at top level
            result.Should().HaveCount(1);
            result[0].Name.Should().Be("Parent");
            result[0].Children.Should().HaveCount(1);
            result[0].Children[0].Name.Should().Be("Child");
        }
    }

    [Fact]
    public async Task GetAppSubtreeAsync_ReturnsSubtreeForApp()
    {
        var options = CreateInMemoryDbContextOptions();
        var parentId = Guid.NewGuid();
        var childId = Guid.NewGuid();

        using (var context = new AppDbContext(options))
        {
            var parent = new App { Id = parentId, Name = "Root", Slug = "root" };
            var child = new App { Id = childId, Name = "Sub", Slug = "sub", ParentAppId = parentId };
            context.Apps.AddRange(parent, child);
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var result = await service.GetAppSubtreeAsync(parentId);

            result.Should().NotBeNull();
            result!.Name.Should().Be("Root");
            result.Children.Should().HaveCount(1);
        }
    }

    [Fact]
    public async Task GetAppSubtreeAsync_NonExistentApp_ReturnsNull()
    {
        var options = CreateInMemoryDbContextOptions();
        using var context = new AppDbContext(options);
        var service = CreateService(context);

        var result = await service.GetAppSubtreeAsync(Guid.NewGuid());

        result.Should().BeNull();
    }

    [Fact]
    public async Task MoveAppAsync_MovesToNewParent()
    {
        var options = CreateInMemoryDbContextOptions();
        var parentId = Guid.NewGuid();
        var childId = Guid.NewGuid();
        var newParentId = Guid.NewGuid();

        using (var context = new AppDbContext(options))
        {
            context.Apps.AddRange(
                new App { Id = parentId, Name = "Old Parent", Slug = "old-parent" },
                new App { Id = newParentId, Name = "New Parent", Slug = "new-parent" },
                new App { Id = childId, Name = "Child", Slug = "child", ParentAppId = parentId }
            );
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            await service.MoveAppAsync(childId, new MoveAppDto { NewParentAppId = newParentId });
        }

        // Verify
        using (var context = new AppDbContext(options))
        {
            var child = await context.Apps.FindAsync(childId);
            child!.ParentAppId.Should().Be(newParentId);
        }
    }

    [Fact]
    public async Task MoveAppAsync_MoveToRoot_SetsParentNull()
    {
        var options = CreateInMemoryDbContextOptions();
        var parentId = Guid.NewGuid();
        var childId = Guid.NewGuid();

        using (var context = new AppDbContext(options))
        {
            context.Apps.AddRange(
                new App { Id = parentId, Name = "Parent", Slug = "parent" },
                new App { Id = childId, Name = "Child", Slug = "child", ParentAppId = parentId }
            );
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            await service.MoveAppAsync(childId, new MoveAppDto { NewParentAppId = null });
        }

        using (var context = new AppDbContext(options))
        {
            var child = await context.Apps.FindAsync(childId);
            child!.ParentAppId.Should().BeNull();
        }
    }

    [Fact]
    public async Task GetAppTreeAsync_IncludesServicesInTree()
    {
        var options = CreateInMemoryDbContextOptions();
        var appId = Guid.NewGuid();
        var svc1Id = Guid.NewGuid();
        var svc2Id = Guid.NewGuid();

        using (var context = new AppDbContext(options))
        {
            var app = new App { Id = appId, Name = "TestApp", Slug = "test-app" };
            var svc1 = new Service { Id = svc1Id, Name = "Svc1", Slug = "svc1", AppId = appId, ExecutablePath = "test" };
            var svc2 = new Service { Id = svc2Id, Name = "Svc2", Slug = "svc2", AppId = appId, ExecutablePath = "test" };
            context.Apps.Add(app);
            context.Services.AddRange(svc1, svc2);
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var result = await service.GetAppTreeAsync();

            result.Should().HaveCount(1);
            // The service loads via Include, so services should be present
            result[0].Services.Should().HaveCount(2);
            result[0].Services.Select(s => s.Name).Should().Contain("Svc1").And.Contain("Svc2");
        }
    }

    [Fact]
    public async Task ReorderChildrenAsync_UpdatesSortOrder()
    {
        var options = CreateInMemoryDbContextOptions();
        var parentId = Guid.NewGuid();
        var child1Id = Guid.NewGuid();
        var child2Id = Guid.NewGuid();
        var child3Id = Guid.NewGuid();

        using (var context = new AppDbContext(options))
        {
            context.Apps.AddRange(
                new App { Id = parentId, Name = "Parent", Slug = "parent" },
                new App { Id = child1Id, Name = "C1", Slug = "c1", ParentAppId = parentId, SortOrder = 0 },
                new App { Id = child2Id, Name = "C2", Slug = "c2", ParentAppId = parentId, SortOrder = 1 },
                new App { Id = child3Id, Name = "C3", Slug = "c3", ParentAppId = parentId, SortOrder = 2 }
            );
            await context.SaveChangesAsync();
        }

        // Reorder: C3, C1, C2
        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            await service.ReorderChildrenAsync(parentId, new ReorderChildrenDto
            {
                OrderedChildIds = new List<Guid> { child3Id, child1Id, child2Id }
            });
        }

        using (var context = new AppDbContext(options))
        {
            var c1 = await context.Apps.FindAsync(child1Id);
            var c2 = await context.Apps.FindAsync(child2Id);
            var c3 = await context.Apps.FindAsync(child3Id);

            c3!.SortOrder.Should().Be(0);
            c1!.SortOrder.Should().Be(1);
            c2!.SortOrder.Should().Be(2);
        }
    }
}
