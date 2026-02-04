using Xunit;
using FluentAssertions;
using System.Collections.Generic;
using Innovatek.Parallel.TemplateEngine;

namespace Innovatek.Parallel.TemplateEngine.Tests;

public class ResolveVariablesTests
{
    [Fact]
    public async Task ResolveVariables_ShouldReplaceDirectVariables()
    {
        // Arrange
        var variables = new Dictionary<string, string>
        {
            { "BasePath", "/usr/local" }
        };
        var variableResolver = new DefaultVariableResolver(variables);
        var input = "Path: {BasePath}";

        // Act
        var result = await variableResolver.ResolveVariablesAsync(input);

        // Assert
        result.Result.Should().Be("Path: /usr/local");
        result.IsCircular.Should().BeFalse();
        result.CircularVariable.Should().BeNull();
    }

    [Fact]
    public async Task ResolveVariables_ShouldHandleNestedVariables()
    {
        // Arrange
        var variables = new Dictionary<string, string>
        {
            { "BasePath", "/usr/local" },
            { "SubPath", "{AppName}/bin" },
            { "AppName", "MyApp" }
        };
        var variableResolver = new DefaultVariableResolver(variables);
        var input = "Path: {BasePath}/{SubPath}";

        // Act
        var result = await variableResolver.ResolveVariablesAsync(input);

        // Assert
        result.Result.Should().Be("Path: /usr/local/MyApp/bin");
        result.IsCircular.Should().BeFalse();
        result.CircularVariable.Should().BeNull();
    }

    [Fact]
    public async Task ResolveVariables_ShouldDetectCircularReferences()
    {
        // Arrange
        var variables = new Dictionary<string, string>
        {
            { "A", "{B}" },
            { "B", "{A}" }
        };
        var variableResolver = new DefaultVariableResolver(variables);
        var input = "Path: {A}";

        // Act
        var result = (await variableResolver.ResolveVariablesAsync(input));

        // Assert
        result.IsCircular.Should().BeTrue();
        result.CircularVariable.Should().Be("A");
    }

    [Fact]
    public async Task ResolveVariables_ShouldHandleMissingVariables()
    {
        // Arrange
        var variables = new Dictionary<string, string>
        {
            { "BasePath", "/usr/local" }
        };
        var variableResolver = new DefaultVariableResolver(variables);
        var input = "Path: {UndefinedVar}";

        // Act
        var result = (await variableResolver.ResolveVariablesAsync(input));

        // Assert
        result.Result.Should().Be("Path: {UndefinedVar}"); // Unresolved placeholder remains intact
        result.IsCircular.Should().BeFalse(); // Not a circular reference
        result.CircularVariable.Should().BeNull(); // No circular variable
    }

    [Fact]
    public async Task ResolveVariables_ShouldHandleEmptyInput()
    {
        // Arrange
        var variables = new Dictionary<string, string>
        {
            { "BasePath", "/usr/local" }
        };
        var variableResolver = new DefaultVariableResolver(variables);
        var input = string.Empty;

        // Act
        var result = await variableResolver.ResolveVariablesAsync(input);

        // Assert
        result.Result.Should().Be(string.Empty);
        result.IsCircular.Should().BeFalse();
        result.CircularVariable.Should().BeNull();
    }

    [Fact]
    public async Task ResolveVariables_ShouldHandleNoPlaceholders()
    {
        // Arrange
        var variables = new Dictionary<string, string>
        {
            { "BasePath", "/usr/local" }
        };
        var variableResolver = new DefaultVariableResolver(variables);
        var input = "No placeholders here";

        // Act
        var result = await variableResolver.ResolveVariablesAsync(input);

        // Assert
        result.Result.Should().Be("No placeholders here");
        result.IsCircular.Should().BeFalse();
        result.CircularVariable.Should().BeNull();
    }

    [Fact]
    public async Task ResolveVariables_ShouldHandleMultiplePlaceholders()
    {
        // Arrange
        var variables = new Dictionary<string, string>
        {
            { "BasePath", "/usr/local" },
            { "SubPath", "bin" },
            { "AppName", "MyApp" }
        };
        var variableResolver = new DefaultVariableResolver(variables);
        var input = "Path: {BasePath}/{SubPath}/{AppName}";

        // Act
        var result = await variableResolver.ResolveVariablesAsync(input);

        // Assert
        result.Result.Should().Be("Path: /usr/local/bin/MyApp");
        result.IsCircular.Should().BeFalse();
        result.CircularVariable.Should().BeNull();
    }

    [Fact]
    public async Task ResolveVariables_ShouldHandleMultipleUnresolvedVariables()
    {
        // Arrange
        var variables = new Dictionary<string, string>
        {
            { "BasePath", "/usr/local" }
        };
        var variableResolver = new DefaultVariableResolver(variables);
        var input = "Path: {UndefinedVar1}/{UndefinedVar2}";

        // Act
        var result = await variableResolver.ResolveVariablesAsync(input);

        // Assert
        result.Result.Should().Be("Path: {UndefinedVar1}/{UndefinedVar2}"); // Unresolved placeholders remain intact
        result.IsCircular.Should().BeFalse(); // Not a circular reference
        result.CircularVariable.Should().BeNull(); // No circular variable
    }

    [Fact]
    public async Task ResolveVariables_ShouldHandlePartiallyResolvedVariables()
    {
        // Arrange
        var variables = new Dictionary<string, string>
        {
            { "BasePath", "/usr/local" }
        };
        var variableResolver = new DefaultVariableResolver(variables);
        var input = "Path: {BasePath}/{UndefinedVar}";

        // Act
        var result = await variableResolver.ResolveVariablesAsync(input);

        // Assert
        result.Result.Should().Be("Path: /usr/local/{UndefinedVar}"); // Partially resolved
        result.IsCircular.Should().BeFalse(); // Not a circular reference
        result.CircularVariable.Should().BeNull(); // No circular variable
    }

    [Fact]
    public async Task ResolveVariables_ShouldHandleDeeplyNestedVariables()
    {
        // Arrange
        var variables = new Dictionary<string, string>
        {
            { "Level1", "{Level2}" },
            { "Level2", "{Level3}" },
            { "Level3", "/final/path" }
        };
        var variableResolver = new DefaultVariableResolver(variables);
        var input = "Path: {Level1}";

        // Act
        var result = await variableResolver.ResolveVariablesAsync(input);

        // Assert
        result.Result.Should().Be("Path: /final/path"); // Fully resolved
        result.IsCircular.Should().BeFalse(); // Not a circular reference
        result.CircularVariable.Should().BeNull(); // No circular variable
    }

    [Fact]
    public async Task ResolveVariables_ShouldHandleSelfReferencingVariable()
    {
        // Arrange
        var variables = new Dictionary<string, string>
        {
            { "A", "{A}" }
        };
        var variableResolver = new DefaultVariableResolver(variables);
        var input = "Path: {A}";

        // Act
        var result = await variableResolver.ResolveVariablesAsync(input);

        // Assert
        result.Result.Should().Be("Path: {A}"); // Self-referencing placeholder remains intact
        result.IsCircular.Should().BeTrue(); // Circular reference detected
        result.CircularVariable.Should().Be("A"); // Circular variable identified
    }

    [Fact]
    public async Task ResolveVariables_ShouldHandleEmptyVariablesDictionary()
    {
        // Arrange
        var variables = new Dictionary<string, string>(); // Empty dictionary
        var variableResolver = new DefaultVariableResolver(variables);
        var input = "Path: {BasePath}";

        // Act
        var result = await variableResolver.ResolveVariablesAsync(input);

        // Assert
        result.Result.Should().Be("Path: {BasePath}"); // Unresolved placeholder remains intact
        result.IsCircular.Should().BeFalse(); // Not a circular reference
        result.CircularVariable.Should().BeNull(); // No circular variable
    }

    [Fact]
    public async Task ResolveVariables_ShouldHandleComplexMixedCase()
    {
        // Arrange
        var variables = new Dictionary<string, string>
        {
            { "BasePath", "/usr/local" },
            { "SubPath", "{AppName}/bin" },
            { "AppName", "MyApp" }
        };
        var variableResolver = new DefaultVariableResolver(variables);
        var input = "Path: {BasePath}/{SubPath}/{UndefinedVar}";

        // Act
        var result = await variableResolver.ResolveVariablesAsync(input);

        // Assert
        result.Result.Should().Be("Path: /usr/local/MyApp/bin/{UndefinedVar}"); // Partially resolved
        result.IsCircular.Should().BeFalse(); // Not a circular reference
        result.CircularVariable.Should().BeNull(); // No circular variable
    }
}
