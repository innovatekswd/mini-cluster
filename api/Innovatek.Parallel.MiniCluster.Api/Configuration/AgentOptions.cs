using System.ComponentModel.DataAnnotations;

namespace Innovatek.Parallel.MiniCluster.Api.Configuration;

/// <summary>
/// Configuration for running MiniCluster in agent mode.
/// When enabled, this instance registers with a controller and sends heartbeats.
/// </summary>
public class AgentOptions
{
    public const string SectionName = "Agent";

    /// <summary>
    /// Whether this instance runs in agent mode.
    /// Can also be enabled via --agent CLI flag.
    /// </summary>
    public bool Enabled { get; set; } = false;

    /// <summary>
    /// URL of the controller to register with (e.g., "https://controller.internal:5147").
    /// Required when agent mode is enabled.
    /// </summary>
    public string ControllerUrl { get; set; } = string.Empty;

    /// <summary>
    /// API key for authenticating with the controller.
    /// Must match a key registered on the controller side.
    /// </summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>
    /// Display name for this agent node. Defaults to machine hostname.
    /// </summary>
    public string? Name { get; set; }

    /// <summary>
    /// How often to send heartbeats to the controller, in seconds.
    /// </summary>
    [Range(5, 300, ErrorMessage = "HeartbeatIntervalSeconds must be between 5 and 300")]
    public int HeartbeatIntervalSeconds { get; set; } = 30;

    /// <summary>
    /// The endpoint URL that the controller can use to reach this agent.
    /// If not set, auto-detected from the server's bound addresses.
    /// </summary>
    public string? AdvertiseEndpoint { get; set; }

    /// <summary>
    /// Labels for node targeting (e.g., {"env": "prod", "region": "us-east"}).
    /// </summary>
    public Dictionary<string, string> Labels { get; set; } = new();
}
