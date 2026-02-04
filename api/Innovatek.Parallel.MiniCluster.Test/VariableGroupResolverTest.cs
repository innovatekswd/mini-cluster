using FluentAssertions;
using Innovatek.Parallel.MiniCluster.Api.Services;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Innovatek.Parallel.TemplateEngine;
using Moq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Innovatek.Parallel.MiniCluster.Test
{
    public class VariableGroupResolverTest
    {
        [Fact]
        public async Task ResolveVariables_ShouldResolveUsingActiveVariableGroup()
        {
            // Arrange
            var activeVariableGroup = new VariableGroup
            {
                Id = Guid.NewGuid(),
                Name = "ActiveGroup",
                IsActive = true,
                Variables = new Dictionary<string, string>
                    {
                        { "BasePath", "/usr/local" },
                        { "AppName", "MyApp" }
                    }
            };

            var mockVariableGroupService = new Mock<IVariableGroupService>();
            mockVariableGroupService
                .Setup(service => service.GetActiveVariableGroupAsync())
                .ReturnsAsync(activeVariableGroup);

            var resolver = new VariableGroupResolver(mockVariableGroupService.Object);
            var input = "Path: {BasePath}/{AppName}";

            // Act
            var result = await resolver.ResolveVariablesAsync(input);

            // Assert
            result.Result.Should().Be("Path: /usr/local/MyApp");
            result.IsCircular.Should().BeFalse();
            result.CircularVariable.Should().BeNull();
        }

        [Fact]
        public async Task ResolveVariables_ShouldHandleNoActiveVariableGroup()
        {
            // Arrange
            var mockVariableGroupService = new Mock<IVariableGroupService>();
            mockVariableGroupService
                .Setup(service => service.GetActiveVariableGroupAsync())
                .ReturnsAsync((VariableGroup?)null);

            var resolver = new VariableGroupResolver(mockVariableGroupService.Object);
            var input = "Path: {BasePath}";

            // Act
            var result = await resolver.ResolveVariablesAsync(input);

            // Assert
            result.Result.Should().Be("Path: {BasePath}"); // Unresolved placeholder remains intact
            result.IsCircular.Should().BeFalse();
            result.CircularVariable.Should().BeNull();
        }

        [Fact]
        public async Task ResolveVariables_ShouldDetectCircularReferences()
        {
            // Arrange
            var activeVariableGroup = new VariableGroup
            {
                Id = Guid.NewGuid(),
                Name = "ActiveGroup",
                IsActive = true,
                Variables = new Dictionary<string, string>
                    {
                        { "A", "{B}" },
                        { "B", "{A}" }
                    }
            };

            var mockVariableGroupService = new Mock<IVariableGroupService>();
            mockVariableGroupService
                .Setup(service => service.GetActiveVariableGroupAsync())
                .ReturnsAsync(activeVariableGroup);

            var resolver = new VariableGroupResolver(mockVariableGroupService.Object);
            var input = "Path: {A}";

            // Act
            var result = await resolver.ResolveVariablesAsync(input);

            // Assert
            result.IsCircular.Should().BeTrue();
            result.CircularVariable.Should().Be("A");
        }

        [Fact]
        public async Task ResolveVariables_ShouldHandlePartiallyResolvedVariables()
        {
            // Arrange
            var activeVariableGroup = new VariableGroup
            {
                Id = Guid.NewGuid(),
                Name = "ActiveGroup",
                IsActive = true,
                Variables = new Dictionary<string, string>
                    {
                        { "BasePath", "/usr/local" }
                    }
            };

            var mockVariableGroupService = new Mock<IVariableGroupService>();
            mockVariableGroupService
                .Setup(service => service.GetActiveVariableGroupAsync())
                .ReturnsAsync(activeVariableGroup);

            var resolver = new VariableGroupResolver(mockVariableGroupService.Object);
            var input = "Path: {BasePath}/{UndefinedVar}";

            // Act
            var result = await resolver.ResolveVariablesAsync(input);

            // Assert
            result.Result.Should().Be("Path: /usr/local/{UndefinedVar}"); // Partially resolved
            result.IsCircular.Should().BeFalse();
            result.CircularVariable.Should().BeNull();
        }

        [Fact]
        public async Task ResolveVariables_ShouldHandleEmptyInput()
        {
            // Arrange
            var activeVariableGroup = new VariableGroup
            {
                Id = Guid.NewGuid(),
                Name = "ActiveGroup",
                IsActive = true,
                Variables = new Dictionary<string, string>
                    {
                        { "BasePath", "/usr/local" }
                    }
            };

            var mockVariableGroupService = new Mock<IVariableGroupService>();
            mockVariableGroupService
                .Setup(service => service.GetActiveVariableGroupAsync())
                .ReturnsAsync(activeVariableGroup);

            var resolver = new VariableGroupResolver(mockVariableGroupService.Object);
            var input = string.Empty;

            // Act
            var result = await resolver.ResolveVariablesAsync(input);

            // Assert
            result.Result.Should().Be(string.Empty);
            result.IsCircular.Should().BeFalse();
            result.CircularVariable.Should().BeNull();
        }
        [Fact]
        public async Task ResolveVariables_ShouldBeCaseInsensitive()
        {
            // Arrange
            var variables = new Dictionary<string, string>
            {
                { "BasePath", "/usr/local" },
                { "AppName", "MyApp" }
            };
            var variableResolver = new DefaultVariableResolver(variables);

            // Act & Assert
            (await variableResolver.ResolveVariablesAsync("Path: {basepath}/{appname}")).Result
                .Should().Be("Path: /usr/local/MyApp");
            (await variableResolver.ResolveVariablesAsync("Path: {BASEPATH}/{APPNAME}")).Result
                .Should().Be("Path: /usr/local/MyApp");
            (await variableResolver.ResolveVariablesAsync("Path: {BaSePaTh}/{ApPnAmE}")).Result
                .Should().Be("Path: /usr/local/MyApp");
        }

        [Fact]
        public async Task ResolveVariables_ShouldTrimVariableNames()
        {
            // Arrange
            var variables = new Dictionary<string, string>
            {
                { "BasePath", "/usr/local" }
            };
            var variableResolver = new DefaultVariableResolver(variables);

            // Act
            var result = await variableResolver.ResolveVariablesAsync("Path: {  BasePath  }");

            // Assert
            result.Result.Should().Be("Path: /usr/local");
        }
    }
}
