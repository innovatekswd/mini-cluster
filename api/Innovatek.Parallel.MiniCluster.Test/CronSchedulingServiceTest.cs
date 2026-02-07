using FluentAssertions;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Services;
using Innovatek.Parallel.MiniCluster.Api.Dtos;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;

namespace Innovatek.Parallel.MiniCluster.Test;

public class CronSchedulingServiceTest
{
    private DbContextOptions<AppDbContext> CreateInMemoryDbContextOptions()
    {
        return new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
    }

    private CronSchedulingService CreateService(AppDbContext context)
    {
        var mockLogger = new Mock<ILogger<CronSchedulingService>>();
        return new CronSchedulingService(context, mockLogger.Object);
    }

    [Fact]
    public async Task GetAllJobsAsync_EmptyDb_ReturnsEmptyList()
    {
        var options = CreateInMemoryDbContextOptions();
        using var context = new AppDbContext(options);
        var service = CreateService(context);

        var result = await service.GetAllJobsAsync();

        result.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateJobAsync_ValidCron_CreatesJob()
    {
        var options = CreateInMemoryDbContextOptions();
        var serviceId = Guid.NewGuid();

        // Add a target service
        using (var context = new AppDbContext(options))
        {
            context.Services.Add(new Service
            {
                Id = serviceId,
                Name = "TestService",
                Slug = "test-service",
                ExecutablePath = "dotnet"
            });
            await context.SaveChangesAsync();
        }

        CronJobResponseDto result;
        using (var context = new AppDbContext(options))
        {
            var svc = CreateService(context);
            result = await svc.CreateJobAsync(new CreateCronJobDto
            {
                Name = "Test Job",
                Description = "A test job",
                TargetType = CronTarget.Service,
                ServiceId = serviceId,
                CronExpression = "0 */5 * * * *", // Every 5 minutes (6-field)
                Action = CronAction.Restart,
                WaitForCompletion = true,
                TimeoutSeconds = 300,
                MissedPolicy = CronMissedPolicy.Skip
            });
        }

        result.Should().NotBeNull();
        result.Name.Should().Be("Test Job");
        result.CronExpression.Should().Be("0 */5 * * * *");
        result.IsEnabled.Should().BeTrue();
        result.NextRun.Should().NotBeNull();
        result.TargetType.Should().Be(CronTarget.Service);
    }

    [Fact]
    public async Task CreateJobAsync_InvalidCronExpression_Throws()
    {
        var options = CreateInMemoryDbContextOptions();
        using var context = new AppDbContext(options);
        var service = CreateService(context);

        var act = async () => await service.CreateJobAsync(new CreateCronJobDto
        {
            Name = "Bad Job",
            TargetType = CronTarget.Script,
            ScriptPath = "/bin/test.sh",
            CronExpression = "invalid-cron",
            Action = CronAction.Script
        });

        await act.Should().ThrowAsync<Exception>();
    }

    [Fact]
    public async Task GetJobAsync_ExistingJob_ReturnsJob()
    {
        var options = CreateInMemoryDbContextOptions();
        var jobId = Guid.NewGuid();

        using (var context = new AppDbContext(options))
        {
            context.CronJobs.Add(new CronJob
            {
                Id = jobId,
                Name = "Existing Job",
                CronExpression = "0 0 * * * *",
                TargetType = CronTarget.Script,
                ScriptPath = "/bin/test.sh",
                Action = CronAction.Script,
                IsEnabled = true
            });
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var result = await service.GetJobAsync(jobId);

            result.Should().NotBeNull();
            result!.Name.Should().Be("Existing Job");
            result.Id.Should().Be(jobId);
        }
    }

    [Fact]
    public async Task GetJobAsync_NonExistentJob_ReturnsNull()
    {
        var options = CreateInMemoryDbContextOptions();
        using var context = new AppDbContext(options);
        var service = CreateService(context);

        var result = await service.GetJobAsync(Guid.NewGuid());

        result.Should().BeNull();
    }

    [Fact]
    public async Task DeleteJobAsync_ExistingJob_ReturnsTrue()
    {
        var options = CreateInMemoryDbContextOptions();
        var jobId = Guid.NewGuid();

        using (var context = new AppDbContext(options))
        {
            context.CronJobs.Add(new CronJob
            {
                Id = jobId,
                Name = "Deletable",
                CronExpression = "0 0 * * * *",
                TargetType = CronTarget.Script,
                ScriptPath = "/bin/test.sh",
                Action = CronAction.Script
            });
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var result = await service.DeleteJobAsync(jobId);
            result.Should().BeTrue();
        }

        // Verify deletion
        using (var context = new AppDbContext(options))
        {
            var job = await context.CronJobs.FindAsync(jobId);
            job.Should().BeNull();
        }
    }

    [Fact]
    public async Task DeleteJobAsync_NonExistentJob_ReturnsFalse()
    {
        var options = CreateInMemoryDbContextOptions();
        using var context = new AppDbContext(options);
        var service = CreateService(context);

        var result = await service.DeleteJobAsync(Guid.NewGuid());

        result.Should().BeFalse();
    }

    [Fact]
    public async Task EnableDisableJobAsync_TogglesState()
    {
        var options = CreateInMemoryDbContextOptions();
        var jobId = Guid.NewGuid();

        using (var context = new AppDbContext(options))
        {
            context.CronJobs.Add(new CronJob
            {
                Id = jobId,
                Name = "Toggle Job",
                CronExpression = "0 0 * * * *",
                TargetType = CronTarget.Script,
                ScriptPath = "/bin/toggle.sh",
                Action = CronAction.Script,
                IsEnabled = true
            });
            await context.SaveChangesAsync();
        }

        // Disable
        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var result = await service.DisableJobAsync(jobId);
            result.Should().BeTrue();
        }

        using (var context = new AppDbContext(options))
        {
            var job = await context.CronJobs.FindAsync(jobId);
            job!.IsEnabled.Should().BeFalse();
        }

        // Re-enable
        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var result = await service.EnableJobAsync(jobId);
            result.Should().BeTrue();
        }

        using (var context = new AppDbContext(options))
        {
            var job = await context.CronJobs.FindAsync(jobId);
            job!.IsEnabled.Should().BeTrue();
        }
    }

    [Fact]
    public async Task GetAllJobsAsync_ReturnsAllJobs()
    {
        var options = CreateInMemoryDbContextOptions();

        using (var context = new AppDbContext(options))
        {
            context.CronJobs.AddRange(
                new CronJob { Name = "Job1", CronExpression = "0 0 * * * *", TargetType = CronTarget.Script, ScriptPath = "/a.sh", Action = CronAction.Script },
                new CronJob { Name = "Job2", CronExpression = "0 30 * * * *", TargetType = CronTarget.Script, ScriptPath = "/b.sh", Action = CronAction.Script }
            );
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var result = await service.GetAllJobsAsync();

            result.Should().HaveCount(2);
            result.Select(j => j.Name).Should().Contain("Job1").And.Contain("Job2");
        }
    }
}
