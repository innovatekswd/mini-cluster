namespace Innovatek.Parallel.MiniCluster.Api.Services;

/// <summary>
/// Alerting engine configuration bound from appsettings "Alerting" section.
/// </summary>
public class AlertingOptions
{
    public const string SectionName = "Alerting";

    public bool Enabled { get; set; } = true;
    public int EvaluationIntervalSeconds { get; set; } = 10;
    public int MaxActiveAlerts { get; set; } = 100;

    public AlertEmailOptions Email { get; set; } = new();
}

public class AlertEmailOptions
{
    public string SmtpHost { get; set; } = string.Empty;
    public int SmtpPort { get; set; } = 587;
    public string SmtpUser { get; set; } = string.Empty;
    public string SmtpPassword { get; set; } = string.Empty;
    public string FromAddress { get; set; } = "minicluster@localhost";
}
