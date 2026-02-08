using FluentAssertions;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Services;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace Innovatek.Parallel.MiniCluster.Test;

public class IdentifierResolverTest
{
    private DbContextOptions<AppDbContext> CreateDbOptions()
    {
        return new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
    }

    // ─── GetShortId ─────────────────────────────────────────

    [Fact]
    public void GetShortId_ReturnsFirst8HexChars()
    {
        var options = CreateDbOptions();
        using var context = new AppDbContext(options);
        var resolver = new IdentifierResolver(context);
        var id = Guid.Parse("abcdef01-2345-6789-abcd-ef0123456789");

        var shortId = resolver.GetShortId(id);

        shortId.Should().Be("abcdef01");
    }

    // ─── ResolveAppAsync ────────────────────────────────────

    [Fact]
    public async Task ResolveAppAsync_EmptyString_ReturnsNotFound()
    {
        var options = CreateDbOptions();
        using var context = new AppDbContext(options);
        var resolver = new IdentifierResolver(context);

        var result = await resolver.ResolveAppAsync("");

        result.Success.Should().BeFalse();
        result.Error.Should().Contain("not found");
    }

    [Fact]
    public async Task ResolveAppAsync_WhitespaceString_ReturnsNotFound()
    {
        var options = CreateDbOptions();
        using var context = new AppDbContext(options);
        var resolver = new IdentifierResolver(context);

        var result = await resolver.ResolveAppAsync("   ");

        result.Success.Should().BeFalse();
    }

    [Fact]
    public async Task ResolveAppAsync_FullUuid_ExistingApp_ReturnsOk()
    {
        var options = CreateDbOptions();
        var appId = Guid.NewGuid();

        using (var context = new AppDbContext(options))
        {
            context.Apps.Add(new App { Id = appId, Name = "TestApp", Slug = "test-app" });
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var resolver = new IdentifierResolver(context);
            var result = await resolver.ResolveAppAsync(appId.ToString());

            result.Success.Should().BeTrue();
            result.Value.Should().Be(appId);
        }
    }

    [Fact]
    public async Task ResolveAppAsync_FullUuid_NonExistent_ReturnsNotFound()
    {
        var options = CreateDbOptions();
        using var context = new AppDbContext(options);
        var resolver = new IdentifierResolver(context);

        var result = await resolver.ResolveAppAsync(Guid.NewGuid().ToString());

        result.Success.Should().BeFalse();
    }

    [Fact]
    public async Task ResolveAppAsync_ShortId_UniqueMatch_ReturnsOk()
    {
        var options = CreateDbOptions();
        var appId = Guid.NewGuid();

        using (var context = new AppDbContext(options))
        {
            context.Apps.Add(new App { Id = appId, Name = "TestApp", Slug = "test-app" });
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var resolver = new IdentifierResolver(context);
            var shortId = appId.ToString("N")[..8];
            var result = await resolver.ResolveAppAsync(shortId);

            result.Success.Should().BeTrue();
            result.Value.Should().Be(appId);
        }
    }

    [Fact]
    public async Task ResolveAppAsync_BySlug_ReturnsOk()
    {
        var options = CreateDbOptions();
        var appId = Guid.NewGuid();

        using (var context = new AppDbContext(options))
        {
            context.Apps.Add(new App { Id = appId, Name = "My Web App", Slug = "my-web-app" });
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var resolver = new IdentifierResolver(context);
            var result = await resolver.ResolveAppAsync("my-web-app");

            result.Success.Should().BeTrue();
            result.Value.Should().Be(appId);
        }
    }

    [Fact]
    public async Task ResolveAppAsync_ByName_CaseInsensitive_ReturnsOk()
    {
        var options = CreateDbOptions();
        var appId = Guid.NewGuid();

        using (var context = new AppDbContext(options))
        {
            context.Apps.Add(new App { Id = appId, Name = "WebServer", Slug = "webserver" });
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var resolver = new IdentifierResolver(context);
            var result = await resolver.ResolveAppAsync("WEBSERVER");

            result.Success.Should().BeTrue();
            result.Value.Should().Be(appId);
        }
    }

    [Fact]
    public async Task ResolveAppAsync_PartialName_UniqueMatch_ReturnsOk()
    {
        var options = CreateDbOptions();
        var appId = Guid.NewGuid();

        using (var context = new AppDbContext(options))
        {
            context.Apps.Add(new App { Id = appId, Name = "UniqueApplicationName", Slug = "unique-app" });
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var resolver = new IdentifierResolver(context);
            var result = await resolver.ResolveAppAsync("UniqueApplication");

            result.Success.Should().BeTrue();
            result.Value.Should().Be(appId);
        }
    }

    [Fact]
    public async Task ResolveAppAsync_PartialName_MultipleMatches_ReturnsAmbiguous()
    {
        var options = CreateDbOptions();

        using (var context = new AppDbContext(options))
        {
            context.Apps.Add(new App { Id = Guid.NewGuid(), Name = "WebApp-Frontend", Slug = "webapp-fe" });
            context.Apps.Add(new App { Id = Guid.NewGuid(), Name = "WebApp-Backend", Slug = "webapp-be" });
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var resolver = new IdentifierResolver(context);
            var result = await resolver.ResolveAppAsync("WebApp");

            result.Success.Should().BeFalse();
            result.AmbiguousMatches.Should().HaveCount(2);
        }
    }

    [Fact]
    public async Task ResolveAppAsync_NoMatch_ReturnsNotFound()
    {
        var options = CreateDbOptions();

        using (var context = new AppDbContext(options))
        {
            context.Apps.Add(new App { Id = Guid.NewGuid(), Name = "ExistingApp", Slug = "existing" });
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var resolver = new IdentifierResolver(context);
            var result = await resolver.ResolveAppAsync("nonexistent");

            result.Success.Should().BeFalse();
            result.Error.Should().Contain("not found");
        }
    }

    // ─── ResolveServiceAsync ────────────────────────────────

    [Fact]
    public async Task ResolveServiceAsync_EmptyString_ReturnsNotFound()
    {
        var options = CreateDbOptions();
        using var context = new AppDbContext(options);
        var resolver = new IdentifierResolver(context);

        var result = await resolver.ResolveServiceAsync("");

        result.Success.Should().BeFalse();
    }

    [Fact]
    public async Task ResolveServiceAsync_FullUuid_ReturnsOk()
    {
        var options = CreateDbOptions();
        var appId = Guid.NewGuid();
        var serviceId = Guid.NewGuid();

        using (var context = new AppDbContext(options))
        {
            context.Apps.Add(new App { Id = appId, Name = "App1", Slug = "app1" });
            context.Services.Add(new Service
            {
                Id = serviceId,
                Name = "svc1",
                Slug = "svc1",
                AppId = appId,
                ExecutablePath = "dotnet"
            });
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var resolver = new IdentifierResolver(context);
            var result = await resolver.ResolveServiceAsync(serviceId.ToString());

            result.Success.Should().BeTrue();
            result.Value.Should().Be(serviceId);
        }
    }

    [Fact]
    public async Task ResolveServiceAsync_FullUuid_NonExistent_ReturnsNotFound()
    {
        var options = CreateDbOptions();
        using var context = new AppDbContext(options);
        var resolver = new IdentifierResolver(context);

        var result = await resolver.ResolveServiceAsync(Guid.NewGuid().ToString());

        result.Success.Should().BeFalse();
    }

    [Fact]
    public async Task ResolveServiceAsync_AppSlashService_BySlug_ReturnsOk()
    {
        var options = CreateDbOptions();
        var appId = Guid.NewGuid();
        var serviceId = Guid.NewGuid();

        using (var context = new AppDbContext(options))
        {
            context.Apps.Add(new App { Id = appId, Name = "MyApp", Slug = "myapp" });
            context.Services.Add(new Service
            {
                Id = serviceId,
                Name = "Web Server",
                Slug = "web-server",
                AppId = appId,
                ExecutablePath = "node"
            });
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var resolver = new IdentifierResolver(context);
            var result = await resolver.ResolveServiceAsync("myapp/web-server");

            result.Success.Should().BeTrue();
            result.Value.Should().Be(serviceId);
        }
    }

    [Fact]
    public async Task ResolveServiceAsync_AppSlashService_ByName_ReturnsOk()
    {
        var options = CreateDbOptions();
        var appId = Guid.NewGuid();
        var serviceId = Guid.NewGuid();

        using (var context = new AppDbContext(options))
        {
            context.Apps.Add(new App { Id = appId, Name = "MyApp", Slug = "myapp" });
            context.Services.Add(new Service
            {
                Id = serviceId,
                Name = "Web Server",
                Slug = "web-server",
                AppId = appId,
                ExecutablePath = "node"
            });
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var resolver = new IdentifierResolver(context);
            var result = await resolver.ResolveServiceAsync("myapp/Web Server");

            result.Success.Should().BeTrue();
            result.Value.Should().Be(serviceId);
        }
    }

    [Fact]
    public async Task ResolveServiceAsync_AppSlashService_AppNotFound_ReturnsNotFound()
    {
        var options = CreateDbOptions();
        using var context = new AppDbContext(options);
        var resolver = new IdentifierResolver(context);

        var result = await resolver.ResolveServiceAsync("nonexistent/svc");

        result.Success.Should().BeFalse();
        result.Error.Should().Contain("not found");
    }

    [Fact]
    public async Task ResolveServiceAsync_BySlug_ReturnsOk()
    {
        var options = CreateDbOptions();
        var appId = Guid.NewGuid();
        var serviceId = Guid.NewGuid();

        using (var context = new AppDbContext(options))
        {
            context.Apps.Add(new App { Id = appId, Name = "App", Slug = "app" });
            context.Services.Add(new Service
            {
                Id = serviceId,
                Name = "API Gateway",
                Slug = "api-gateway",
                AppId = appId,
                ExecutablePath = "dotnet"
            });
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var resolver = new IdentifierResolver(context);
            var result = await resolver.ResolveServiceAsync("api-gateway");

            result.Success.Should().BeTrue();
            result.Value.Should().Be(serviceId);
        }
    }

    [Fact]
    public async Task ResolveServiceAsync_ByName_CaseInsensitive_ReturnsOk()
    {
        var options = CreateDbOptions();
        var appId = Guid.NewGuid();
        var serviceId = Guid.NewGuid();

        using (var context = new AppDbContext(options))
        {
            context.Apps.Add(new App { Id = appId, Name = "App", Slug = "app" });
            context.Services.Add(new Service
            {
                Id = serviceId,
                Name = "MyService",
                Slug = "myservice",
                AppId = appId,
                ExecutablePath = "bin"
            });
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var resolver = new IdentifierResolver(context);
            var result = await resolver.ResolveServiceAsync("MYSERVICE");

            result.Success.Should().BeTrue();
            result.Value.Should().Be(serviceId);
        }
    }

    [Fact]
    public async Task ResolveServiceAsync_MultipleNameMatches_ReturnsAmbiguous()
    {
        var options = CreateDbOptions();
        var appId = Guid.NewGuid();

        using (var context = new AppDbContext(options))
        {
            context.Apps.Add(new App { Id = appId, Name = "App", Slug = "app" });
            context.Services.Add(new Service
            {
                Id = Guid.NewGuid(), Name = "Worker-1", Slug = "worker-1",
                AppId = appId, ExecutablePath = "dotnet"
            });
            context.Services.Add(new Service
            {
                Id = Guid.NewGuid(), Name = "Worker-2", Slug = "worker-2",
                AppId = appId, ExecutablePath = "dotnet"
            });
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var resolver = new IdentifierResolver(context);
            var result = await resolver.ResolveServiceAsync("Worker");

            result.Success.Should().BeFalse();
            result.AmbiguousMatches.Should().HaveCount(2);
        }
    }
}
