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
using Microsoft.Extensions.Logging;

namespace Innovatek.Parallel.MiniCluster.Test
{
    public class ImportServicesTest
    {
        private readonly IMapper _mapperMock;
        private readonly DefaultVariableResolverFactory _variableResolverMock;
        private readonly AppDbContext _dbContext;
        private readonly ILogger<ImportController> _loggerMock;

        public ImportServicesTest()
        {
            // Set up in-memory database
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            _dbContext = new AppDbContext(options);

            // Set up real AutoMapper
            var mapperConfig = new MapperConfiguration(cfg =>
            {
                cfg.AddProfile<MappingProfile>(); // Add your mapping profile(s) here
            });
            _mapperMock = new Mapper(mapperConfig);
            _variableResolverMock = new DefaultVariableResolverFactory();
            _loggerMock = Mock.Of<ILogger<ImportController>>();
        }

        [Fact]
        public async Task ImportServices_ShouldResolveVariables_WhenResolveVariablesIsTrue()
        {
            // Arrange
            var controller = new ImportController(_dbContext, _mapperMock, _variableResolverMock, _loggerMock);
            var importRequest = new ImportController.ImportRequest
            {
                VariableGroups = new List<CreateVariableGroupDto> {
                    new CreateVariableGroupDto(){
                        Name = "group1",
                        Variables = new Dictionary<string, string>
                        {
                            { "BasePath", "/usr/local" }
                        }
                    }                
                },
                Services = new List<ServiceBase>
                    {
                        new ServiceBase
                        {
                            Name = "Service1",
                            ExecutablePath = "{BasePath}/service1.exe",
                            Arguments = "--arg1",
                            EnvironmentVariables = new Dictionary<string, string>
                            {
                                { "EnvKey1", "{BasePath}/env" }
                            }
                        }
                    }
            };

            var fileContent = JsonSerializer.Serialize(importRequest);
            var file = new FormFile(
                new MemoryStream(Encoding.UTF8.GetBytes(fileContent)),
                0,
                fileContent.Length,
                "file",
                "import.json"
            );

            // Act
            var result = await controller.ImportServices(file, resolveVariables: true);

            // Assert
            var services = await _dbContext.Services.ToListAsync();
            services.Should().HaveCount(1);
            services[0].ExecutablePath.Should().Be("/usr/local/service1.exe");
            services[0].EnvironmentVariables["EnvKey1"].Should().Be("/usr/local/env");
        }

        [Fact]
        public async Task ImportServices_ShouldImportVariables_WhenNoServicesAreProvided()
        {
            // Arrange
            var controller = new ImportController(_dbContext, _mapperMock, _variableResolverMock, _loggerMock);
            var group1Vars = new CreateVariableGroupDto() { 
                Name = "group1", 
                Variables = new Dictionary<string, string> {
                        { "BasePath", "/usr/local" },
                { "ServiceName", "MyService" }
            }
            };
            var importRequest = new ImportController.ImportRequest
            {
                VariableGroups = new List<CreateVariableGroupDto>() { group1Vars },
                
                Services = new List<ServiceBase>() // No services
            };

            var fileContent = JsonSerializer.Serialize(importRequest);
            var file = new FormFile(
                new MemoryStream(Encoding.UTF8.GetBytes(fileContent)),
                0,
                fileContent.Length,
                "file",
                "import.json"
            );

            // Act
            var result = await controller.ImportServices(file, resolveVariables: false);

            // Assert
            var variableGroups = await _dbContext.VariableGroups.ToListAsync();
            variableGroups.Should().HaveCount(1);
            variableGroups[0].Variables.Should().ContainKey("BasePath");
            variableGroups[0].Variables["BasePath"].Should().Be("/usr/local");
            variableGroups[0].Variables["ServiceName"].Should().Be("MyService");
        }

        [Fact]
        public async Task ImportServices_ShouldUpdateExistingVariableGroup()
        {
            // Arrange
            var existingGroup = new VariableGroup
            {
                Id = Guid.NewGuid(),
                Name = "group1",
                Description = "Old description",
                Variables = new Dictionary<string, string>
                {
                    { "BasePath", "/old/path" }
                },
                IsActive = false
            };

            _dbContext.VariableGroups.Add(existingGroup);
            await _dbContext.SaveChangesAsync();

            var controller = new ImportController(_dbContext, _mapperMock, _variableResolverMock, _loggerMock);
            var importRequest = new ImportController.ImportRequest
            {
                VariableGroups = new List<CreateVariableGroupDto>
                {
                    new CreateVariableGroupDto
                    {
                        Name = "group1",
                        Description = "Updated description",
                        Variables = new Dictionary<string, string>
                        {
                            { "BasePath", "/new/path" }
                        },
                        IsActive = true
                    }
                },
                Services = new List<ServiceBase>() // No services
            };

            var fileContent = JsonSerializer.Serialize(importRequest);
            var file = new FormFile(
                new MemoryStream(Encoding.UTF8.GetBytes(fileContent)),
                0,
                fileContent.Length,
                "file",
                "import.json"
            );

            // Act
            var result = await controller.ImportServices(file, resolveVariables: false);

            // Assert
            var variableGroups = await _dbContext.VariableGroups.ToListAsync();
            variableGroups.Should().HaveCount(1);
            variableGroups[0].Name.Should().Be("group1");
            variableGroups[0].Description.Should().Be("Updated description");
            variableGroups[0].Variables["BasePath"].Should().Be("/new/path");
            variableGroups[0].IsActive.Should().BeTrue();
        }

        [Fact]
        public async Task ImportServices_ShouldHandleEmptyServicesList()
        {
            // Arrange
            var controller = new ImportController(_dbContext, _mapperMock, _variableResolverMock, _loggerMock);
            var importRequest = new ImportController.ImportRequest
            {
                Services = new List<ServiceBase>() // Empty list
            };

            var fileContent = JsonSerializer.Serialize(importRequest);
            var file = new FormFile(
                new MemoryStream(Encoding.UTF8.GetBytes(fileContent)),
                0,
                fileContent.Length,
                "file",
                "import.json"
            );

            // Act
            var result = await controller.ImportServices(file, resolveVariables: true);

            // Assert
            result.Should().BeOfType<OkObjectResult>();
            ((OkObjectResult)result).Value.Should().BeEquivalentTo(new { Message = "Services and VariableGroups imported successfully." });
        }
        [Fact]
        public async Task ExportedJson_CanBeImportedBack()
        {
            // Arrange: Import initial data
            var controller = new ImportController(_dbContext, _mapperMock, _variableResolverMock, _loggerMock);
            var importRequest = new ImportController.ImportRequest
            {
                VariableGroups = new List<CreateVariableGroupDto>
                {
                    new CreateVariableGroupDto
                    {
                        Name = "group1",
                        Description = "desc",
                        Variables = new Dictionary<string, string> { { "Key", "Value" } },
                        IsActive = true
                    }
                },
                Services = new List<ServiceBase>
                {
                    new ServiceBase
                    {
                        Name = "Service1",
                        ExecutablePath = "/bin/service1",
                        Arguments = "--help",
                        EnvironmentVariables = new Dictionary<string, string> { { "ENV", "dev" } }
                    }
                }
            };
            var fileContent = JsonSerializer.Serialize(importRequest);
            var file = new FormFile(
                new MemoryStream(Encoding.UTF8.GetBytes(fileContent)),
                0,
                fileContent.Length,
                "file",
                "import.json"
            );
            await controller.ImportServices(file, resolveVariables: false);

            // Act: Export config
            var exportResult = await controller.ExportConfig();
            exportResult.Should().BeOfType<FileStreamResult>();
            var fileResult = exportResult as FileStreamResult;
            fileResult.Should().NotBeNull();
            using var reader = new StreamReader(fileResult!.FileStream);
            var exportedJson = await reader.ReadToEndAsync();

            // Clear database
            _dbContext.VariableGroups.RemoveRange(_dbContext.VariableGroups);
            _dbContext.Services.RemoveRange(_dbContext.Services);
            await _dbContext.SaveChangesAsync();

            // Act: Import exported JSON
            var importFile = new FormFile(
                new MemoryStream(Encoding.UTF8.GetBytes(exportedJson)),
                0,
                exportedJson.Length,
                "file",
                "exported.json"
            );
            var importResult = await controller.ImportServices(importFile, resolveVariables: false);

            // Assert: Data is restored
            importResult.Should().BeOfType<OkObjectResult>();
            var variableGroups = await _dbContext.VariableGroups.ToListAsync();
            variableGroups.Should().HaveCount(1);
            variableGroups[0].Name.Should().Be("group1");
            var services = await _dbContext.Services.ToListAsync();
            services.Should().HaveCount(1);
            services[0].Name.Should().Be("Service1");
        }
    }
    public class ImportExportServicesTest
    {
        private readonly IMapper _mapper;
        private readonly DefaultVariableResolverFactory _variableResolverFactory;
        private readonly AppDbContext _dbContext;
        private readonly ILogger<ImportController> _loggerMock;

        public ImportExportServicesTest()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            _dbContext = new AppDbContext(options);

            var mapperConfig = new MapperConfiguration(cfg =>
            {
                cfg.AddProfile<MappingProfile>();
            });
            _mapper = new Mapper(mapperConfig);
            _variableResolverFactory = new DefaultVariableResolverFactory();
            _loggerMock = Mock.Of<ILogger<ImportController>>();
        }

        [Fact]
        public async Task ImportServices_ShouldImportAndExportConfig()
        {
            // Arrange: Prepare import data
            var controller = new ImportController(_dbContext, _mapper, _variableResolverFactory, _loggerMock);
            var importRequest = new ImportController.ImportRequest
            {
                VariableGroups = new List<CreateVariableGroupDto>
                {
                    new CreateVariableGroupDto
                    {
                        Name = "group1",
                        Description = "desc",
                        Variables = new Dictionary<string, string> { { "Key", "Value" } },
                        IsActive = true
                    }
                },
                Services = new List<ServiceBase>
                {
                    new ServiceBase
                    {
                        Name = "Service1",
                        ExecutablePath = "/bin/service1",
                        Arguments = "--help",
                        EnvironmentVariables = new Dictionary<string, string> { { "ENV", "dev" } }
                    }
                }
            };
            var fileContent = JsonSerializer.Serialize(importRequest);
            var file = new FormFile(
                new MemoryStream(Encoding.UTF8.GetBytes(fileContent)),
                0,
                fileContent.Length,
                "file",
                "import.json"
            );

            // Act: Import
            var importResult = await controller.ImportServices(file, resolveVariables: false);

            // Assert: Import
            importResult.Should().BeOfType<OkObjectResult>();
            var variableGroups = await _dbContext.VariableGroups.ToListAsync();
            variableGroups.Should().HaveCount(1);
            var services = await _dbContext.Services.ToListAsync();
            services.Should().HaveCount(1);

            // Act: Export
            var exportResult = await controller.ExportConfig();

            // Assert: Export
            exportResult.Should().BeOfType<FileStreamResult>();
            var fileResult = exportResult as FileStreamResult;
            fileResult!.ContentType.Should().Be("application/json");
            fileResult.FileDownloadName.Should().Be("config-export.json");

            // Read and verify exported JSON
            using var reader = new StreamReader(fileResult.FileStream);
            var exportedJson = await reader.ReadToEndAsync();
            exportedJson.Should().Contain("group1");
            exportedJson.Should().Contain("Service1");
        }

        [Fact]
        public async Task ExportConfig_ShouldReturnEmptyLists_WhenNoData()
        {
            // Arrange
            var controller = new ImportController(_dbContext, _mapper, _variableResolverFactory, _loggerMock);

            // Act
            var exportResult = await controller.ExportConfig();

            // Assert
            exportResult.Should().BeOfType<FileStreamResult>();
            var fileResult = exportResult as FileStreamResult;
            using var reader = new StreamReader(fileResult!.FileStream);
            var exportedJson = await reader.ReadToEndAsync();
            exportedJson.Should().Contain("\"VariableGroups\": []");
            exportedJson.Should().Contain("\"Services\": []");
        }
    }
}
