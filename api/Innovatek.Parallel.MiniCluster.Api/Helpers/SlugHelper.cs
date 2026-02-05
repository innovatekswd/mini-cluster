using System.Text;
using System.Text.RegularExpressions;

namespace Innovatek.Parallel.MiniCluster.Api.Helpers;

/// <summary>
/// Helper class for generating URL-friendly slugs from names.
/// </summary>
public static partial class SlugHelper
{
    /// <summary>
    /// Generates a URL-friendly slug from a given name.
    /// Rules:
    /// - Lowercase
    /// - Trim whitespace
    /// - Replace spaces/tabs/special chars with hyphens
    /// - Remove consecutive hyphens
    /// - Remove leading/trailing hyphens
    /// - Alphanumeric + hyphens only
    /// </summary>
    public static string GenerateSlug(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            return string.Empty;

        // Convert to lowercase and trim
        var slug = name.ToLowerInvariant().Trim();

        // Replace common word separators with hyphens
        slug = slug.Replace(' ', '-')
                   .Replace('\t', '-')
                   .Replace('_', '-')
                   .Replace('.', '-');

        // Remove any characters that aren't alphanumeric or hyphens
        slug = NonAlphanumericRegex().Replace(slug, "");

        // Replace multiple consecutive hyphens with a single hyphen
        slug = MultipleHyphensRegex().Replace(slug, "-");

        // Remove leading and trailing hyphens
        slug = slug.Trim('-');

        return slug;
    }

    /// <summary>
    /// Generates a unique slug by appending a suffix if the base slug already exists.
    /// </summary>
    public static string GenerateUniqueSlug(string name, Func<string, bool> slugExists)
    {
        var baseSlug = GenerateSlug(name);
        
        if (string.IsNullOrEmpty(baseSlug))
            baseSlug = "unnamed";

        if (!slugExists(baseSlug))
            return baseSlug;

        // Try appending numbers until we find a unique one
        var counter = 2;
        string candidateSlug;
        do
        {
            candidateSlug = $"{baseSlug}-{counter}";
            counter++;
        } while (slugExists(candidateSlug) && counter < 1000);

        return candidateSlug;
    }

    /// <summary>
    /// Validates that a slug follows the correct format.
    /// </summary>
    public static bool IsValidSlug(string slug)
    {
        if (string.IsNullOrWhiteSpace(slug))
            return false;

        // Must be lowercase, alphanumeric with hyphens, no leading/trailing/consecutive hyphens
        return ValidSlugRegex().IsMatch(slug);
    }

    [GeneratedRegex("[^a-z0-9-]")]
    private static partial Regex NonAlphanumericRegex();

    [GeneratedRegex("-{2,}")]
    private static partial Regex MultipleHyphensRegex();

    [GeneratedRegex("^[a-z0-9]+(-[a-z0-9]+)*$")]
    private static partial Regex ValidSlugRegex();
}
