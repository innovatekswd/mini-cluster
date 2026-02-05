using Innovatek.Parallel.TemplateEngine;

namespace Innovatek.Parallel.MiniCluster.Api.Services
{
    public class EnvironmentResolver : IVariableResolver
    {
        private readonly IEnvironmentService _environmentService;

        public EnvironmentResolver(IEnvironmentService environmentService)
        {
            _environmentService = environmentService;
        }

        public async Task<(string Result, bool IsCircular, string? CircularVariable)> ResolveVariablesAsync(string input)
        {
            // Retrieve the active Environment
            var activeEnvironment = await _environmentService.GetActiveEnvironmentAsync();

            if (activeEnvironment == null)
            {
                // No active Environment, return the input as-is
                return (input, false, null);
            }

            // Initialize the DefaultVariableResolver with the active Environment's variables
            var variableResolver = new DefaultVariableResolver(activeEnvironment.Variables);

            try
            {
                // Attempt to resolve the variables
                var resolvedResult = await variableResolver.ResolveVariablesAsync(input);

                // Return the resolved result
                return resolvedResult;
            }
            catch (InvalidOperationException ex)
            {
                // Handle circular references
                var circularVariable = ExtractCircularVariableFromException(ex);
                return (input, true, circularVariable);
            }
        }

        private string? ExtractCircularVariableFromException(InvalidOperationException ex)
        {
            // Extract the circular variable name from the exception message
            const string circularReferenceMessage = "Circular reference detected for variable '";
            if (ex.Message.StartsWith(circularReferenceMessage))
            {
                var startIndex = circularReferenceMessage.Length;
                var endIndex = ex.Message.IndexOf("'.", startIndex);
                if (endIndex > startIndex)
                {
                    return ex.Message.Substring(startIndex, endIndex - startIndex);
                }
            }
            return null;
        }
    }
    
}
