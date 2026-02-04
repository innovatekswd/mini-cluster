using Innovatek.Parallel.TemplateEngine;

namespace Innovatek.Parallel.MiniCluster.Api.Services
{
    public class VariableGroupResolver : IVariableResolver
    {
        private readonly IVariableGroupService _variableGroupService;

        public VariableGroupResolver(IVariableGroupService variableGroupService)
        {
            _variableGroupService = variableGroupService;
        }

        public async Task<(string Result, bool IsCircular, string? CircularVariable)> ResolveVariablesAsync(string input)
        {
            // Retrieve the active VariableGroup
            var activeVariableGroup = await _variableGroupService.GetActiveVariableGroupAsync();

            if (activeVariableGroup == null)
            {
                // No active VariableGroup, return the input as-is
                return (input, false, null);
            }

            // Initialize the DefaultVariableResolver with the active VariableGroup's variables
            var variableResolver = new DefaultVariableResolver(activeVariableGroup.Variables);

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
