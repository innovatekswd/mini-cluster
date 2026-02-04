using System.ComponentModel.DataAnnotations;

namespace Innovatek.Parallel.MiniCluster.Api.Validation;

/// <summary>
/// Validates that a string is a valid URL, but only if it's not null or empty.
/// Allows null/empty values to pass validation.
/// </summary>
public class OptionalUrlAttribute : ValidationAttribute
{
    protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
    {
        // Allow null or empty strings
        if (value == null || string.IsNullOrWhiteSpace(value.ToString()))
        {
            return ValidationResult.Success;
        }

        var urlString = value.ToString();
        
        // Try to parse as URI
        if (Uri.TryCreate(urlString, UriKind.Absolute, out var uri))
        {
            // Check if it's http or https
            if (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)
            {
                return ValidationResult.Success;
            }
        }

        return new ValidationResult(ErrorMessage ?? "Access link must be a valid HTTP or HTTPS URL");
    }
}
