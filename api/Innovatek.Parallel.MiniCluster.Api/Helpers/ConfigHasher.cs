using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Innovatek.Parallel.MiniCluster.Core.Entities;

namespace Innovatek.Parallel.MiniCluster.Api.Helpers;

/// <summary>
/// Computes deterministic hashes of app/service configuration for drift detection.
/// Used to detect when an agent's local config diverges from the controller's expected state.
/// </summary>
public static class ConfigHasher
{
    /// <summary>
    /// Compute a SHA256 hash of an app's configuration (name, env vars, services).
    /// </summary>
    public static string ComputeAppHash(App app)
    {
        var payload = new
        {
            name = app.Name,
            slug = app.Slug,
            icon = app.Icon,
            color = app.Color,
            services = app.Services
                .OrderBy(s => s.Name)
                .Select(s => new
                {
                    name = s.Name,
                    slug = s.Slug,
                    executablePath = s.ExecutablePath,
                    arguments = s.Arguments,
                    workingDirectory = s.WorkingDirectory,
                    autoStart = s.AutoStart,
                    environmentVariables = s.EnvironmentVariables
                        .OrderBy(kv => kv.Key)
                        .ToDictionary(kv => kv.Key, kv => kv.Value),
                    isExternal = s.IsExternal,
                    useShellExecute = s.UseShellExecute,
                    createNoWindow = s.CreateNoWindow,
                    captureOutput = s.CaptureOutput
                })
                .ToList()
        };

        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false
        });

        return ComputeSha256(json);
    }

    /// <summary>
    /// Hash an API key for storage. Keys are stored hashed, never in plain text.
    /// </summary>
    public static string HashApiKey(string plainKey)
    {
        return ComputeSha256(plainKey);
    }

    /// <summary>
    /// Generate a new random API key with a prefix.
    /// </summary>
    public static string GenerateApiKey(string prefix = "sk_agent")
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        var key = Convert.ToBase64String(bytes)
            .Replace("+", "")
            .Replace("/", "")
            .Replace("=", "");
        return $"{prefix}_{key}";
    }

    private static string ComputeSha256(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexStringLower(bytes);
    }
}
