namespace Innovatek.Parallel.MiniCluster.Api.Helpers;

public static class PathValidationHelper
{
    public static bool IsValidPath(string? path)
    {
        if (string.IsNullOrWhiteSpace(path))
            return false;

        try
        {
            // Check for path traversal attempts
            var invalidChars = Path.GetInvalidPathChars();
            if (path.Any(c => invalidChars.Contains(c)))
                return false;

            // Check for dangerous patterns
            var dangerousPatterns = new[] { "..", "~", "%", "*", "?" };
            if (dangerousPatterns.Any(pattern => path.Contains(pattern)))
                return false;

            // Try to get full path to validate
            var fullPath = Path.GetFullPath(path);
            return true;
        }
        catch
        {
            return false;
        }
    }

    public static string SanitizePath(string path)
    {
        if (string.IsNullOrWhiteSpace(path))
            throw new ArgumentException("Path cannot be null or empty", nameof(path));

        // Remove any invalid characters
        var invalidChars = Path.GetInvalidPathChars();
        return string.Join("", path.Where(c => !invalidChars.Contains(c)));
    }
}
