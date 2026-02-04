using AutoMapper;
using FluentAssertions;
using Innovatek.Parallel.MiniCluster.Api.Controllers;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Services;
using Innovatek.Parallel.MiniCluster.Core.Entities;
using Innovatek.Parallel.TemplateEngine;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Innovatek.Parallel.MiniCluster.Test
{
    public class AttachServiceFileTest
    {
        private AppDbContext CreateDbContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
            return new AppDbContext(options);
        }

        private IMapper CreateMapper()
        {
            var config = new MapperConfiguration(cfg => { });
            return config.CreateMapper();
        }

        private Mock<IIdentifierResolver> CreateMockResolver(Guid serviceId)
        {
            var mockResolver = new Mock<IIdentifierResolver>();
            mockResolver.Setup(r => r.ResolveServiceAsync(It.IsAny<string>()))
                .ReturnsAsync(ResolveResult<Guid>.Ok(serviceId));
            return mockResolver;
        }

        private Mock<IIdentifierResolver> CreateNotFoundResolver()
        {
            var mockResolver = new Mock<IIdentifierResolver>();
            mockResolver.Setup(r => r.ResolveServiceAsync(It.IsAny<string>()))
                .ReturnsAsync(ResolveResult<Guid>.NotFound("nonexistent-service"));
            return mockResolver;
        }

        [Fact]
        public async Task AttachFile_ShouldStoreFileWithVariables()
        {
            // Arrange
            var db = CreateDbContext();
            var mapper = CreateMapper();
            var variableResolverFactory = new Mock<IVariableResolverFactory>();

            var service = new Service
            {
                Id = Guid.NewGuid(),
                Name = "TestService",
                ExecutablePath = "C:\\TestService\\service.exe",
                CreatedAt = DateTime.UtcNow,
                ModifiedAt = DateTime.UtcNow
            };
            db.Services.Add(service);
            await db.SaveChangesAsync();

            var mockResolver = CreateMockResolver(service.Id);
            var controller = new ServiceFilesController(db, mapper, variableResolverFactory.Object, mockResolver.Object);

            var request = new AttachFileRequest
            {
                Name = "Config {Env}",
                FilePath = "C:\\Services\\{Env}\\config.json"
            };

            // Act
            var result = await controller.AttachFile(service.Id.ToString(), request);

            // Assert
            result.Should().BeOfType<OkObjectResult>();
            var okResult = result as OkObjectResult;
            okResult!.Value.Should().BeOfType<ServiceFile>();
            var serviceFile = okResult.Value as ServiceFile;
            serviceFile.Should().NotBeNull();
            serviceFile!.ServiceId.Should().Be(service.Id);
            serviceFile.Name.Should().Be("Config {Env}");
            serviceFile.FilePath.Should().Be("C:\\Services\\{Env}\\config.json");

            var dbFile = await db.ServiceFiles.FirstOrDefaultAsync(f => f.ServiceId == service.Id);
            dbFile.Should().NotBeNull();
            dbFile!.Name.Should().Be("Config {Env}");
            dbFile.FilePath.Should().Be("C:\\Services\\{Env}\\config.json");
        }

        [Fact]
        public async Task AttachFile_ShouldReturnNotFound_ForNonExistentService()
        {
            // Arrange
            var db = CreateDbContext();
            var mapper = CreateMapper();
            var variableResolverFactory = new Mock<IVariableResolverFactory>();
            var mockResolver = CreateNotFoundResolver();
            var controller = new ServiceFilesController(db, mapper, variableResolverFactory.Object, mockResolver.Object);

            var request = new AttachFileRequest
            {
                Name = "Config {Env}",
                FilePath = "C:\\Services\\{Env}\\config.json"
            };

            // Act
            var result = await controller.AttachFile("nonexistent-service", request);

            // Assert
            result.Should().BeOfType<NotFoundObjectResult>();
        }

        [Fact]
        public async Task AttachFile_ShouldStoreMultipleFilesForSameService()
        {
            // Arrange
            var db = CreateDbContext();
            var mapper = CreateMapper();
            var variableResolverFactory = new Mock<IVariableResolverFactory>();

            var service = new Service
            {
                Id = Guid.NewGuid(),
                Name = "TestService",
                ExecutablePath = "C:\\TestService\\service.exe",
                CreatedAt = DateTime.UtcNow,
                ModifiedAt = DateTime.UtcNow
            };
            db.Services.Add(service);
            await db.SaveChangesAsync();

            var mockResolver = CreateMockResolver(service.Id);
            var controller = new ServiceFilesController(db, mapper, variableResolverFactory.Object, mockResolver.Object);

            var request1 = new AttachFileRequest
            {
                Name = "Config {Env}",
                FilePath = "C:\\Services\\{Env}\\config.json"
            };
            var request2 = new AttachFileRequest
            {
                Name = "Log {Env}",
                FilePath = "C:\\Services\\{Env}\\log.txt"
            };

            // Act
            var result1 = await controller.AttachFile(service.Id.ToString(), request1);
            var result2 = await controller.AttachFile(service.Id.ToString(), request2);

            // Assert
            var files = await db.ServiceFiles.Where(f => f.ServiceId == service.Id).ToListAsync();
            files.Should().HaveCount(2);
            files.Should().Contain(f => f.Name == "Config {Env}" && f.FilePath == "C:\\Services\\{Env}\\config.json");
            files.Should().Contain(f => f.Name == "Log {Env}" && f.FilePath == "C:\\Services\\{Env}\\log.txt");
        }

        [Theory]
        [InlineData("", "C:\\Services\\{Env}\\config.json")]
        [InlineData("Config {Env}", "")]
        [InlineData("", "")]
        public async Task AttachFile_ShouldReturnBadRequest_ForEmptyNameOrPath(string name, string filePath)
        {
            // Arrange
            var db = CreateDbContext();
            var mapper = CreateMapper();
            var variableResolverFactory = new Mock<IVariableResolverFactory>();

            var service = new Service
            {
                Id = Guid.NewGuid(),
                Name = "TestService",
                ExecutablePath = "C:\\TestService\\service.exe",
                CreatedAt = DateTime.UtcNow,
                ModifiedAt = DateTime.UtcNow
            };
            db.Services.Add(service);
            await db.SaveChangesAsync();

            var mockResolver = CreateMockResolver(service.Id);
            var controller = new ServiceFilesController(db, mapper, variableResolverFactory.Object, mockResolver.Object);

            var request = new AttachFileRequest
            {
                Name = name,
                FilePath = filePath
            };

            // Act
            var result = await controller.AttachFile(service.Id.ToString(), request);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task AttachFile_ShouldStoreDifferentVariablesInNameAndPath()
        {
            // Arrange
            var db = CreateDbContext();
            var mapper = CreateMapper();
            var variableResolverFactory = new Mock<IVariableResolverFactory>();

            var service = new Service
            {
                Id = Guid.NewGuid(),
                Name = "TestService",
                ExecutablePath = "C:\\TestService\\service.exe",
                CreatedAt = DateTime.UtcNow,
                ModifiedAt = DateTime.UtcNow
            };
            db.Services.Add(service);
            await db.SaveChangesAsync();

            var mockResolver = CreateMockResolver(service.Id);
            var controller = new ServiceFilesController(db, mapper, variableResolverFactory.Object, mockResolver.Object);

            var request = new AttachFileRequest
            {
                Name = "Config {Env}-{Version}",
                FilePath = "C:\\Services\\{Env}\\{Version}\\config.json"
            };

            // Act
            var result = await controller.AttachFile(service.Id.ToString(), request);

            // Assert
            result.Should().BeOfType<OkObjectResult>();
            var okResult = result as OkObjectResult;
            var serviceFile = okResult!.Value as ServiceFile;
            serviceFile.Should().NotBeNull();
            serviceFile!.Name.Should().Be("Config {Env}-{Version}");
            serviceFile.FilePath.Should().Be("C:\\Services\\{Env}\\{Version}\\config.json");
        }
    }
}
