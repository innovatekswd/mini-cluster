using AutoMapper;
using Innovatek.Parallel.MiniCluster.Api.Controllers;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Innovatek.Parallel.TemplateEngine;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.InMemory; // Add this using directive

using FluentAssertions; // Add this using directive at the top of the file

// No other changes are needed in the file as the error is caused by the missing namespace.
// No other changes are needed in the file as the error is caused by the missing namespace.
using Moq;
using System.Text;
using System.Text.Json;
using System.Collections.Generic;
using Microsoft.AspNetCore.Mvc;
using Innovatek.Parallel.MiniCluster.Api.Dtos;

namespace Innovatek.Parallel.MiniCluster.Test
{
    public class DbContextTest
    {
        private DbContextOptions<AppDbContext> CreateInMemoryDbContextOptions()
        {
            return new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString()) // Use a unique database for each test
                .Options;
        }

        [Fact]
        public async Task Should_SaveAndRetrieve_VariablesProperly()
        {
            // Arrange
            var options = CreateInMemoryDbContextOptions();

            var Id = Guid.NewGuid();
            using (var context = new AppDbContext(options))
            {
                var variableGroup = new VariableGroup
                {
                    Id = Id,
                    Name = "TestGroup",
                    Description = "A test variable group",
                    Variables = new Dictionary<string, string>
                              {
                                  { "Key1", "Value1" },
                                  { "Key2", "Value2" }
                              },
                    IsActive = true
                };

                // Act
                context.VariableGroups.Add(variableGroup);
                await context.SaveChangesAsync();
            }
            using (var context = new AppDbContext(options))
            {

                // Retrieve the saved entity
                var savedGroup = await context.VariableGroups.FindAsync(Id);

                // Assert
                savedGroup.Should().NotBeNull();
                savedGroup!.Name.Should().Be("TestGroup");
                savedGroup.Description.Should().Be("A test variable group");
                savedGroup.Variables.Should().ContainKey("Key1").WhoseValue.Should().Be("Value1"); // Corrected method
                savedGroup.Variables.Should().ContainKey("Key2").WhoseValue.Should().Be("Value2"); // Corrected method
                savedGroup.IsActive.Should().BeTrue();
            }

            using (var context = new AppDbContext(options))
            {

                // Retrieve the saved entity
                var savedGroup = (await context.VariableGroups.ToListAsync()).Find(vg=>vg.Id==Id);

                // Assert
                savedGroup.Should().NotBeNull();
                savedGroup!.Name.Should().Be("TestGroup");
                savedGroup.Description.Should().Be("A test variable group");
                savedGroup.Variables.Should().ContainKey("Key1").WhoseValue.Should().Be("Value1"); // Corrected method
                savedGroup.Variables.Should().ContainKey("Key2").WhoseValue.Should().Be("Value2"); // Corrected method
                savedGroup.IsActive.Should().BeTrue();
            }
        }
    }
}
