using FluentAssertions;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Services;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;

namespace Innovatek.Parallel.MiniCluster.Test;

// ── AlertEvaluatorService.Evaluate (operator logic) ──────────────────────────

public class AlertEvaluatorEvaluateTests
{
    [Theory]
    [InlineData(AlertOperator.GreaterThan,        91.0, 90.0, true)]
    [InlineData(AlertOperator.GreaterThan,        90.0, 90.0, false)]
    [InlineData(AlertOperator.GreaterThanOrEqual, 90.0, 90.0, true)]
    [InlineData(AlertOperator.GreaterThanOrEqual, 89.9, 90.0, false)]
    [InlineData(AlertOperator.LessThan,           89.9, 90.0, true)]
    [InlineData(AlertOperator.LessThan,           90.0, 90.0, false)]
    [InlineData(AlertOperator.LessThanOrEqual,    90.0, 90.0, true)]
    [InlineData(AlertOperator.LessThanOrEqual,    90.1, 90.0, false)]
    [InlineData(AlertOperator.Equals,             90.0, 90.0, true)]
    [InlineData(AlertOperator.Equals,             90.1, 90.0, false)]
    [InlineData(AlertOperator.NotEquals,          91.0, 90.0, true)]
    [InlineData(AlertOperator.NotEquals,          90.0, 90.0, false)]
    public void Evaluate_ReturnsExpectedResult(AlertOperator op, double value, double threshold, bool expected)
    {
        var result = AlertEvaluatorService.Evaluate(op, value, threshold);
        result.Should().Be(expected);
    }

    [Fact]
    public void Evaluate_UnknownOperator_ReturnsFalse()
    {
        var result = AlertEvaluatorService.Evaluate((AlertOperator)99, 50, 50);
        result.Should().BeFalse();
    }
}

// ── Duration tracking ─────────────────────────────────────────────────────────

public class AlertEvaluatorDurationTests
{
    private static AlertEvaluatorService BuildService(
        AppDbContext db,
        IAlertMetricsProvider metrics,
        IAlertNotifier? notifier = null)
    {
        var opts = Options.Create(new AlertingOptions { Enabled = true, EvaluationIntervalSeconds = 1 });
        var mockNotifier = notifier ?? Mock.Of<IAlertNotifier>();
        var sp = new ServiceCollection()
            .AddSingleton(db)
            .BuildServiceProvider();

        return new AlertEvaluatorService(
            sp,
            metrics,
            mockNotifier,
            opts,
            NullLogger<AlertEvaluatorService>.Instance);
    }

    private static AppDbContext BuildDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    [Fact]
    public async Task ConditionStartTime_IsTracked_WhenConditionFirstBecomesMet()
    {
        var db = BuildDb();
        var rule = new AlertRule
        {
            Name = "High CPU",
            Metric = AlertMetric.SystemCpuPercent,
            Operator = AlertOperator.GreaterThan,
            Threshold = 80,
            DurationSeconds = 60, // 60s before firing
            CooldownMinutes = 0,
            IsEnabled = true,
        };
        db.AlertRules.Add(rule);
        await db.SaveChangesAsync();

        var mockMetrics = new Mock<IAlertMetricsProvider>();
        mockMetrics.Setup(m => m.GetCurrentValue(AlertMetric.SystemCpuPercent, null)).Returns(95.0);

        var svc = BuildService(db, mockMetrics.Object);

        await svc.EvaluateAllRulesAsync(CancellationToken.None);

        // Condition met but duration not yet elapsed — no event should be created
        db.AlertEvents.Count().Should().Be(0, "duration requirement of 60s not yet elapsed");
        svc.ConditionStartTimes.ContainsKey(rule.Id).Should().BeTrue("start time should be tracked");
    }

    [Fact]
    public async Task AlertFires_WhenConditionHeldLongEnough()
    {
        var db = BuildDb();
        var rule = new AlertRule
        {
            Name = "High CPU",
            Metric = AlertMetric.SystemCpuPercent,
            Operator = AlertOperator.GreaterThan,
            Threshold = 80,
            DurationSeconds = 0, // immediate
            CooldownMinutes = 0,
            IsEnabled = true,
        };
        db.AlertRules.Add(rule);
        await db.SaveChangesAsync();

        var mockMetrics = new Mock<IAlertMetricsProvider>();
        mockMetrics.Setup(m => m.GetCurrentValue(AlertMetric.SystemCpuPercent, null)).Returns(95.0);

        var notifierMock = new Mock<IAlertNotifier>();
        var svc = BuildService(db, mockMetrics.Object, notifierMock.Object);

        await svc.EvaluateAllRulesAsync(CancellationToken.None);

        db.AlertEvents.Count().Should().Be(1);
        var ev = db.AlertEvents.First();
        ev.EventType.Should().Be(AlertEventType.Triggered);
        ev.Value.Should().BeApproximately(95.0, 0.01);
        notifierMock.Verify(n => n.NotifyAsync(It.IsAny<AlertRule>(), It.IsAny<AlertEvent>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task AlertDoesNotFire_WhenInCooldown()
    {
        var db = BuildDb();
        var rule = new AlertRule
        {
            Name = "High CPU",
            Metric = AlertMetric.SystemCpuPercent,
            Operator = AlertOperator.GreaterThan,
            Threshold = 80,
            DurationSeconds = 0,
            CooldownMinutes = 10,
            LastTriggeredAt = DateTime.UtcNow.AddMinutes(-2), // still in cooldown
            IsEnabled = true,
        };
        db.AlertRules.Add(rule);
        await db.SaveChangesAsync();

        var mockMetrics = new Mock<IAlertMetricsProvider>();
        mockMetrics.Setup(m => m.GetCurrentValue(AlertMetric.SystemCpuPercent, null)).Returns(95.0);

        var notifierMock = new Mock<IAlertNotifier>();
        var svc = BuildService(db, mockMetrics.Object, notifierMock.Object);

        await svc.EvaluateAllRulesAsync(CancellationToken.None);

        db.AlertEvents.Count().Should().Be(0, "rule is in cooldown and should not fire again");
        notifierMock.Verify(n => n.NotifyAsync(It.IsAny<AlertRule>(), It.IsAny<AlertEvent>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task AlertFires_WhenCooldownHasExpired()
    {
        var db = BuildDb();
        var rule = new AlertRule
        {
            Name = "High CPU",
            Metric = AlertMetric.SystemCpuPercent,
            Operator = AlertOperator.GreaterThan,
            Threshold = 80,
            DurationSeconds = 0,
            CooldownMinutes = 5,
            LastTriggeredAt = DateTime.UtcNow.AddMinutes(-10), // cooldown expired
            IsEnabled = true,
        };
        db.AlertRules.Add(rule);
        await db.SaveChangesAsync();

        var mockMetrics = new Mock<IAlertMetricsProvider>();
        mockMetrics.Setup(m => m.GetCurrentValue(AlertMetric.SystemCpuPercent, null)).Returns(95.0);

        var notifierMock = new Mock<IAlertNotifier>();
        var svc = BuildService(db, mockMetrics.Object, notifierMock.Object);

        await svc.EvaluateAllRulesAsync(CancellationToken.None);

        db.AlertEvents.Count().Should().Be(1);
        notifierMock.Verify(n => n.NotifyAsync(It.IsAny<AlertRule>(), It.IsAny<AlertEvent>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task AlertResolves_WhenConditionClears()
    {
        var db = BuildDb();
        var rule = new AlertRule
        {
            Name = "High CPU",
            Metric = AlertMetric.SystemCpuPercent,
            Operator = AlertOperator.GreaterThan,
            Threshold = 80,
            DurationSeconds = 0,
            CooldownMinutes = 0,
            IsEnabled = true,
        };
        db.AlertRules.Add(rule);
        await db.SaveChangesAsync();

        var mockMetrics = new Mock<IAlertMetricsProvider>();
        var notifierMock = new Mock<IAlertNotifier>();
        var svc = BuildService(db, mockMetrics.Object, notifierMock.Object);

        // First cycle — fires
        mockMetrics.Setup(m => m.GetCurrentValue(AlertMetric.SystemCpuPercent, null)).Returns(95.0);
        await svc.EvaluateAllRulesAsync(CancellationToken.None);
        db.AlertEvents.Count().Should().Be(1);

        // Second cycle — condition clears, should emit Resolved
        mockMetrics.Setup(m => m.GetCurrentValue(AlertMetric.SystemCpuPercent, null)).Returns(50.0);
        // Simulate cooldown has passed so fire is possible again, but condition cleared
        await svc.EvaluateAllRulesAsync(CancellationToken.None);

        var events = db.AlertEvents.ToList();
        events.Should().Contain(e => e.EventType == AlertEventType.Resolved,
            "condition cleared so a Resolved event should be emitted");
    }

    [Fact]
    public async Task DisabledRule_IsNotEvaluated()
    {
        var db = BuildDb();
        var rule = new AlertRule
        {
            Name = "Disabled Rule",
            Metric = AlertMetric.SystemCpuPercent,
            Operator = AlertOperator.GreaterThan,
            Threshold = 0, // would always fire if enabled
            DurationSeconds = 0,
            CooldownMinutes = 0,
            IsEnabled = false,
        };
        db.AlertRules.Add(rule);
        await db.SaveChangesAsync();

        var mockMetrics = new Mock<IAlertMetricsProvider>();
        mockMetrics.Setup(m => m.GetCurrentValue(It.IsAny<AlertMetric>(), It.IsAny<Guid?>())).Returns(100.0);

        var notifierMock = new Mock<IAlertNotifier>();
        var svc = BuildService(db, mockMetrics.Object, notifierMock.Object);

        await svc.EvaluateAllRulesAsync(CancellationToken.None);

        db.AlertEvents.Count().Should().Be(0, "disabled rule must not fire");
    }

    [Fact]
    public async Task NullMetricValue_DoesNotCrash()
    {
        var db = BuildDb();
        var rule = new AlertRule
        {
            Name = "Service CPU",
            Metric = AlertMetric.ProcessCpuPercent,
            ServiceId = Guid.NewGuid(), // service not running
            Operator = AlertOperator.GreaterThan,
            Threshold = 80,
            DurationSeconds = 0,
            CooldownMinutes = 0,
            IsEnabled = true,
        };
        db.AlertRules.Add(rule);
        await db.SaveChangesAsync();

        var mockMetrics = new Mock<IAlertMetricsProvider>();
        mockMetrics.Setup(m => m.GetCurrentValue(AlertMetric.ProcessCpuPercent, It.IsAny<Guid?>())).Returns((double?)null);

        var svc = BuildService(db, mockMetrics.Object);

        // Must not throw
        await svc.Invoking(s => s.EvaluateAllRulesAsync(CancellationToken.None))
            .Should().NotThrowAsync();
        db.AlertEvents.Count().Should().Be(0);
    }
}

// ── TriggerCount increments ───────────────────────────────────────────────────

public class AlertRuleTriggerCountTests
{
    [Fact]
    public async Task TriggerCount_IncrementsEachTime()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new AppDbContext(options);

        var rule = new AlertRule
        {
            Name = "Repeat Trigger",
            Metric = AlertMetric.SystemCpuPercent,
            Operator = AlertOperator.GreaterThan,
            Threshold = 80,
            DurationSeconds = 0,
            CooldownMinutes = 0,
            IsEnabled = true,
        };
        db.AlertRules.Add(rule);
        await db.SaveChangesAsync();

        var mockMetrics = new Mock<IAlertMetricsProvider>();
        mockMetrics.Setup(m => m.GetCurrentValue(AlertMetric.SystemCpuPercent, null)).Returns(95.0);

        var sp = new ServiceCollection().AddSingleton(db).BuildServiceProvider();
        var svc = new AlertEvaluatorService(
            sp,
            mockMetrics.Object,
            Mock.Of<IAlertNotifier>(),
            Options.Create(new AlertingOptions()),
            NullLogger<AlertEvaluatorService>.Instance);

        // First fire
        await svc.EvaluateAllRulesAsync(CancellationToken.None);
        db.AlertRules.Find(rule.Id)!.TriggerCount.Should().Be(1);

        // Second fire after cooldown (set LastTriggeredAt to past)
        var loaded = db.AlertRules.Find(rule.Id)!;
        loaded.LastTriggeredAt = DateTime.UtcNow.AddHours(-1);
        await db.SaveChangesAsync();
        svc.ConditionStartTimes.Clear();

        await svc.EvaluateAllRulesAsync(CancellationToken.None);
        db.AlertRules.Find(rule.Id)!.TriggerCount.Should().Be(2);
    }
}
