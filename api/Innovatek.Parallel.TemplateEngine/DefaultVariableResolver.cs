using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Innovatek.Parallel.TemplateEngine
{
    public class DefaultVariableResolver : IVariableResolver
    {
        // Cache resolved variables for efficiency
        Dictionary<string, string> resolvedCache = new Dictionary<string, string>();
        HashSet<string> visited = new HashSet<string>();
        private Dictionary<string, string> variables;

        public DefaultVariableResolver(Dictionary<string, string> variables)
        {
            this.variables = new Dictionary<string, string>(
                variables.ToDictionary(
                    kvp => kvp.Key.Trim().ToLowerInvariant(),
                    kvp => kvp.Value
                )
            );
        }

        public virtual Task<(string Result, bool IsCircular, string CircularVariable) >
            ResolveVariablesAsync(string input)
        {
            if (string.IsNullOrEmpty(input)) return Task.FromResult<(string, bool, string)>((string.Empty, false, null));

            try
            {
                // Start resolving the input
                var result = Resolve(input);

                // Check for unresolved placeholders
                var unresolvedPlaceholders = ExtractPlaceholders(result);
                if (unresolvedPlaceholders.Count > 0)
                {
                    return Task.FromResult<(string, bool, string)>((result, false, null)); // Unresolved placeholders are not circular
                }

                return Task.FromResult<(string, bool, string)>((result, false, null));
            }
            catch (InvalidOperationException ex)
            {
                // Extract the circular variable from the exception message
                var circularVariable = ex.Message.Replace("Circular reference detected for variable '", "").Replace("'.", "");
                return Task.FromResult<(string, bool, string)>((input, true, circularVariable));
            }
        }
        
        string Resolve(string value)
        {
            // Extract all placeholders from the string
            var placeholders = ExtractPlaceholders(value);

            foreach (var placeholder in placeholders)
            {
                var normalizedPlaceholder = placeholder.Trim().ToLowerInvariant(); 
                // Detect circular references
                if (visited.Contains(normalizedPlaceholder))
                {
                    throw new InvalidOperationException($"Circular reference detected for variable '{placeholder}'.");
                }

                // If the variable is already resolved, use the cached value
                if (resolvedCache.TryGetValue(normalizedPlaceholder, out var resolvedValue))
                {
                    value = value.Replace($"{{{placeholder}}}", resolvedValue);
                    continue;
                }

                // If the variable exists in the dictionary, resolve it
                if (variables.TryGetValue(normalizedPlaceholder, out var variableValue))
                {
                    visited.Add(normalizedPlaceholder); // Mark the variable as visited
                    var resolved = Resolve(variableValue);
                    visited.Remove(normalizedPlaceholder); // Unmark after resolution

                    // Cache the resolved value
                    resolvedCache[normalizedPlaceholder] = resolved;

                    // Replace the placeholder with the resolved value
                    value = value.Replace($"{{{placeholder}}}", resolved);
                }
                else
                {
                    // Leave unresolved placeholders intact
                    resolvedCache[normalizedPlaceholder] = $"{{{placeholder}}}";
                }
            }

            return value;
        }

        private List<string> ExtractPlaceholders(string input)
        {
            var placeholders = new List<string>();
            var startIndex = 0;

            while ((startIndex = input.IndexOf('{', startIndex)) != -1)
            {
                var endIndex = input.IndexOf('}', startIndex + 1);
                if (endIndex == -1) break;

                var placeholder = input.Substring(startIndex + 1, endIndex - startIndex - 1);
                placeholders.Add(placeholder);
                startIndex = endIndex + 1;
            }

            return placeholders;
        }
    }
}
