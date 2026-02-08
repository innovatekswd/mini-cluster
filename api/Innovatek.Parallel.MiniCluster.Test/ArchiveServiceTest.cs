using FluentAssertions;
using Innovatek.Parallel.MiniCluster.Api.Configuration;
using Innovatek.Parallel.MiniCluster.Api.Models.Explorer;
using Innovatek.Parallel.MiniCluster.Api.Services;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;

namespace Innovatek.Parallel.MiniCluster.Test;

public class ArchiveServiceTest : IDisposable
{
    private readonly string _testDir;
    private readonly ExplorerService _explorerService;
    private readonly ArchiveService _archiveService;

    public ArchiveServiceTest()
    {
        _testDir = Path.Combine(Path.GetTempPath(), $"minicluster-archive-test-{Guid.NewGuid():N}");
        Directory.CreateDirectory(_testDir);

        var options = Options.Create(new ExplorerOptions
        {
            AllowedPaths = [_testDir],
            BlockedPaths = [],
            ShowHiddenFiles = true,
            MaxEditFileSizeMB = 10,
            EnableTerminal = false,
        });

        var explorerLogger = new Mock<ILogger<ExplorerService>>();
        _explorerService = new ExplorerService(options, explorerLogger.Object);

        var archiveLogger = new Mock<ILogger<ArchiveService>>();
        _archiveService = new ArchiveService(_explorerService, archiveLogger.Object);
    }

    public void Dispose()
    {
        try { Directory.Delete(_testDir, true); } catch { }
    }

    private void CreateTestFile(string relativePath, string content = "Hello World")
    {
        var fullPath = Path.Combine(_testDir, relativePath);
        var dir = Path.GetDirectoryName(fullPath);
        if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            Directory.CreateDirectory(dir);
        File.WriteAllText(fullPath, content);
    }

    #region Compress Tests

    [Fact]
    public async Task CompressAsync_SingleFile_Zip_CreatesArchive()
    {
        CreateTestFile("test.txt", "Hello World");
        var outputPath = Path.Combine(_testDir, "output.zip");

        var result = await _archiveService.CompressAsync(new CompressRequest
        {
            Paths = [Path.Combine(_testDir, "test.txt")],
            OutputPath = outputPath,
            Format = "zip"
        });

        result.Success.Should().BeTrue();
        result.EntryCount.Should().Be(1);
        result.OutputPath.Should().Be(outputPath);
        File.Exists(outputPath).Should().BeTrue();
        new System.IO.FileInfo(outputPath).Length.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task CompressAsync_Directory_Zip_IncludesAllFiles()
    {
        Directory.CreateDirectory(Path.Combine(_testDir, "mydir"));
        CreateTestFile("mydir/file1.txt", "File 1");
        CreateTestFile("mydir/file2.txt", "File 2");
        CreateTestFile("mydir/sub/file3.txt", "File 3");
        var outputPath = Path.Combine(_testDir, "mydir.zip");

        var result = await _archiveService.CompressAsync(new CompressRequest
        {
            Paths = [Path.Combine(_testDir, "mydir")],
            OutputPath = outputPath,
            Format = "zip"
        });

        result.Success.Should().BeTrue();
        result.EntryCount.Should().Be(3);
        File.Exists(outputPath).Should().BeTrue();
    }

    [Fact]
    public async Task CompressAsync_MultipleFiles_Zip_CreatesArchive()
    {
        CreateTestFile("a.txt", "AAA");
        CreateTestFile("b.txt", "BBB");
        CreateTestFile("c.txt", "CCC");
        var outputPath = Path.Combine(_testDir, "multi.zip");

        var result = await _archiveService.CompressAsync(new CompressRequest
        {
            Paths = [
                Path.Combine(_testDir, "a.txt"),
                Path.Combine(_testDir, "b.txt"),
                Path.Combine(_testDir, "c.txt"),
            ],
            OutputPath = outputPath,
            Format = "zip"
        });

        result.Success.Should().BeTrue();
        result.EntryCount.Should().Be(3);
    }

    [Fact]
    public async Task CompressAsync_TarGz_CreatesArchive()
    {
        CreateTestFile("data.txt", "Some data content");
        var outputPath = Path.Combine(_testDir, "output.tar.gz");

        var result = await _archiveService.CompressAsync(new CompressRequest
        {
            Paths = [Path.Combine(_testDir, "data.txt")],
            OutputPath = outputPath,
            Format = "tar.gz"
        });

        result.Success.Should().BeTrue();
        result.EntryCount.Should().Be(1);
        File.Exists(outputPath).Should().BeTrue();
    }

    [Fact]
    public async Task CompressAsync_Tar_CreatesArchive()
    {
        CreateTestFile("data.txt", "content");
        var outputPath = Path.Combine(_testDir, "output.tar");

        var result = await _archiveService.CompressAsync(new CompressRequest
        {
            Paths = [Path.Combine(_testDir, "data.txt")],
            OutputPath = outputPath,
            Format = "tar"
        });

        result.Success.Should().BeTrue();
        File.Exists(outputPath).Should().BeTrue();
    }

    [Fact]
    public async Task CompressAsync_TarBz2_CreatesArchive()
    {
        CreateTestFile("data.txt", "bz2 content");
        var outputPath = Path.Combine(_testDir, "output.tar.bz2");

        var result = await _archiveService.CompressAsync(new CompressRequest
        {
            Paths = [Path.Combine(_testDir, "data.txt")],
            OutputPath = outputPath,
            Format = "tar.bz2"
        });

        result.Success.Should().BeTrue();
        File.Exists(outputPath).Should().BeTrue();
    }

    [Fact]
    public async Task CompressAsync_SevenZip_CreatesArchive()
    {
        CreateTestFile("data.txt", "7z content");
        var outputPath = Path.Combine(_testDir, "output.7z");

        var result = await _archiveService.CompressAsync(new CompressRequest
        {
            Paths = [Path.Combine(_testDir, "data.txt")],
            OutputPath = outputPath,
            Format = "7z"
        });

        result.Success.Should().BeTrue();
        File.Exists(outputPath).Should().BeTrue();
    }

    [Fact]
    public async Task CompressAsync_InvalidFormat_ThrowsArgumentException()
    {
        CreateTestFile("data.txt");
        var outputPath = Path.Combine(_testDir, "output.invalid");

        await Assert.ThrowsAsync<ArgumentException>(() =>
            _archiveService.CompressAsync(new CompressRequest
            {
                Paths = [Path.Combine(_testDir, "data.txt")],
                OutputPath = outputPath,
                Format = "invalid"
            }));
    }

    [Fact]
    public async Task CompressAsync_PathNotFound_ThrowsFileNotFoundException()
    {
        var outputPath = Path.Combine(_testDir, "output.zip");

        await Assert.ThrowsAsync<FileNotFoundException>(() =>
            _archiveService.CompressAsync(new CompressRequest
            {
                Paths = [Path.Combine(_testDir, "nonexistent.txt")],
                OutputPath = outputPath,
                Format = "zip"
            }));
    }

    [Fact]
    public async Task CompressAsync_BlockedPath_ThrowsUnauthorizedAccess()
    {
        var outputPath = Path.Combine(_testDir, "output.zip");

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _archiveService.CompressAsync(new CompressRequest
            {
                Paths = ["/etc/passwd"],
                OutputPath = outputPath,
                Format = "zip"
            }));
    }

    [Fact]
    public async Task CompressAsync_ReportsOriginalSize()
    {
        var content = new string('X', 10000);
        CreateTestFile("large.txt", content);
        var outputPath = Path.Combine(_testDir, "large.zip");

        var result = await _archiveService.CompressAsync(new CompressRequest
        {
            Paths = [Path.Combine(_testDir, "large.txt")],
            OutputPath = outputPath,
            Format = "zip"
        });

        result.OriginalSize.Should().Be(10000);
        result.TotalSize.Should().BeLessThan(10000); // Zip should compress repeated chars
    }

    #endregion

    #region Extract Tests

    [Fact]
    public async Task ExtractAsync_Zip_ExtractsFiles()
    {
        // Create a zip first
        CreateTestFile("src/hello.txt", "Hello from zip");
        CreateTestFile("src/world.txt", "World from zip");
        var zipPath = Path.Combine(_testDir, "test.zip");
        await _archiveService.CompressAsync(new CompressRequest
        {
            Paths = [Path.Combine(_testDir, "src")],
            OutputPath = zipPath,
            Format = "zip"
        });

        // Extract to a new directory
        var destDir = Path.Combine(_testDir, "extracted");
        var result = await _archiveService.ExtractAsync(new ExtractRequest
        {
            ArchivePath = zipPath,
            DestinationPath = destDir
        });

        result.Success.Should().BeTrue();
        result.EntryCount.Should().Be(2);
        File.Exists(Path.Combine(destDir, "src", "hello.txt")).Should().BeTrue();
        File.Exists(Path.Combine(destDir, "src", "world.txt")).Should().BeTrue();
    }

    [Fact]
    public async Task ExtractAsync_TarGz_ExtractsFiles()
    {
        CreateTestFile("src2/data.txt", "tar gz data");
        var tarGzPath = Path.Combine(_testDir, "test.tar.gz");
        await _archiveService.CompressAsync(new CompressRequest
        {
            Paths = [Path.Combine(_testDir, "src2")],
            OutputPath = tarGzPath,
            Format = "tar.gz"
        });

        var destDir = Path.Combine(_testDir, "extracted-tgz");
        var result = await _archiveService.ExtractAsync(new ExtractRequest
        {
            ArchivePath = tarGzPath,
            DestinationPath = destDir
        });

        result.Success.Should().BeTrue();
        result.EntryCount.Should().Be(1);
    }

    [Fact]
    public async Task ExtractAsync_SkipsExisting_WhenOverwriteFalse()
    {
        CreateTestFile("overwrite-src/file.txt", "original");
        var zipPath = Path.Combine(_testDir, "overwrite.zip");
        await _archiveService.CompressAsync(new CompressRequest
        {
            Paths = [Path.Combine(_testDir, "overwrite-src")],
            OutputPath = zipPath,
            Format = "zip"
        });

        // Pre-create the destination file
        var destDir = Path.Combine(_testDir, "extracted-ow");
        Directory.CreateDirectory(Path.Combine(destDir, "overwrite-src"));
        File.WriteAllText(Path.Combine(destDir, "overwrite-src", "file.txt"), "existing");

        var result = await _archiveService.ExtractAsync(new ExtractRequest
        {
            ArchivePath = zipPath,
            DestinationPath = destDir,
            Overwrite = false
        });

        result.Success.Should().BeTrue();
        result.EntryCount.Should().Be(0); // Skipped existing
        File.ReadAllText(Path.Combine(destDir, "overwrite-src", "file.txt")).Should().Be("existing");
    }

    [Fact]
    public async Task ExtractAsync_OverwritesExisting_WhenOverwriteTrue()
    {
        CreateTestFile("ow2/file.txt", "new content");
        var zipPath = Path.Combine(_testDir, "ow2.zip");
        await _archiveService.CompressAsync(new CompressRequest
        {
            Paths = [Path.Combine(_testDir, "ow2")],
            OutputPath = zipPath,
            Format = "zip"
        });

        var destDir = Path.Combine(_testDir, "extracted-ow2");
        Directory.CreateDirectory(Path.Combine(destDir, "ow2"));
        File.WriteAllText(Path.Combine(destDir, "ow2", "file.txt"), "old content");

        var result = await _archiveService.ExtractAsync(new ExtractRequest
        {
            ArchivePath = zipPath,
            DestinationPath = destDir,
            Overwrite = true
        });

        result.Success.Should().BeTrue();
        result.EntryCount.Should().Be(1);
        File.ReadAllText(Path.Combine(destDir, "ow2", "file.txt")).Should().Be("new content");
    }

    [Fact]
    public async Task ExtractAsync_ArchiveNotFound_ThrowsFileNotFoundException()
    {
        var destDir = Path.Combine(_testDir, "dest");

        await Assert.ThrowsAsync<FileNotFoundException>(() =>
            _archiveService.ExtractAsync(new ExtractRequest
            {
                ArchivePath = Path.Combine(_testDir, "nonexistent.zip"),
                DestinationPath = destDir
            }));
    }

    [Fact]
    public async Task ExtractAsync_CreatesDestinationDirectory()
    {
        CreateTestFile("auto-dir/file.txt", "test");
        var zipPath = Path.Combine(_testDir, "autodir.zip");
        await _archiveService.CompressAsync(new CompressRequest
        {
            Paths = [Path.Combine(_testDir, "auto-dir")],
            OutputPath = zipPath,
            Format = "zip"
        });

        var destDir = Path.Combine(_testDir, "new-dest-dir");
        Directory.Exists(destDir).Should().BeFalse();

        var result = await _archiveService.ExtractAsync(new ExtractRequest
        {
            ArchivePath = zipPath,
            DestinationPath = destDir
        });

        result.Success.Should().BeTrue();
        Directory.Exists(destDir).Should().BeTrue();
    }

    #endregion

    #region List Contents Tests

    [Fact]
    public async Task ListContentsAsync_ReturnsEntries()
    {
        Directory.CreateDirectory(Path.Combine(_testDir, "browse"));
        CreateTestFile("browse/a.txt", "AAA");
        CreateTestFile("browse/b.txt", "BBB");
        var zipPath = Path.Combine(_testDir, "browse.zip");
        await _archiveService.CompressAsync(new CompressRequest
        {
            Paths = [Path.Combine(_testDir, "browse")],
            OutputPath = zipPath,
            Format = "zip"
        });

        var result = await _archiveService.ListContentsAsync(zipPath);

        result.ArchivePath.Should().Be(zipPath);
        result.Format.Should().Be("zip");
        result.Entries.Count.Should().BeGreaterThanOrEqualTo(2);
        result.Entries.Should().Contain(e => e.Name == "a.txt");
        result.Entries.Should().Contain(e => e.Name == "b.txt");
        result.TotalSize.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task ListContentsAsync_FileNotFound_ThrowsFileNotFoundException()
    {
        await Assert.ThrowsAsync<FileNotFoundException>(() =>
            _archiveService.ListContentsAsync(Path.Combine(_testDir, "nosuch.zip")));
    }

    [Fact]
    public async Task ListContentsAsync_BlockedPath_ThrowsUnauthorizedAccess()
    {
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            _archiveService.ListContentsAsync("/etc/passwd"));
    }

    #endregion

    #region ArchiveFormats Tests

    [Fact]
    public void ArchiveFormats_IsArchive_RecognizesKnownExtensions()
    {
        ArchiveFormats.IsArchive("file.zip").Should().BeTrue();
        ArchiveFormats.IsArchive("file.tar.gz").Should().BeTrue();
        ArchiveFormats.IsArchive("file.tgz").Should().BeTrue();
        ArchiveFormats.IsArchive("file.7z").Should().BeTrue();
        ArchiveFormats.IsArchive("file.rar").Should().BeTrue();
        ArchiveFormats.IsArchive("file.tar.bz2").Should().BeTrue();
        ArchiveFormats.IsArchive("file.tar.xz").Should().BeTrue();
        ArchiveFormats.IsArchive("FILE.ZIP").Should().BeTrue(); // case insensitive
    }

    [Fact]
    public void ArchiveFormats_IsArchive_RejectsNonArchive()
    {
        ArchiveFormats.IsArchive("file.txt").Should().BeFalse();
        ArchiveFormats.IsArchive("file.jpg").Should().BeFalse();
        ArchiveFormats.IsArchive("file.cs").Should().BeFalse();
    }

    [Fact]
    public void ArchiveFormats_WritableFormats_ContainsExpectedFormats()
    {
        ArchiveFormats.WritableFormats.Should().Contain("zip");
        ArchiveFormats.WritableFormats.Should().Contain("tar.gz");
        ArchiveFormats.WritableFormats.Should().Contain("7z");
        ArchiveFormats.WritableFormats.Should().Contain("tar.bz2");
    }

    #endregion

    #region Round-trip Tests

    [Fact]
    public async Task RoundTrip_Zip_PreservesFileContents()
    {
        CreateTestFile("roundtrip/hello.txt", "Hello Round Trip");
        var zipPath = Path.Combine(_testDir, "roundtrip.zip");

        await _archiveService.CompressAsync(new CompressRequest
        {
            Paths = [Path.Combine(_testDir, "roundtrip")],
            OutputPath = zipPath,
            Format = "zip"
        });

        var destDir = Path.Combine(_testDir, "roundtrip-out");
        await _archiveService.ExtractAsync(new ExtractRequest
        {
            ArchivePath = zipPath,
            DestinationPath = destDir
        });

        File.ReadAllText(Path.Combine(destDir, "roundtrip", "hello.txt")).Should().Be("Hello Round Trip");
    }

    [Fact]
    public async Task RoundTrip_TarGz_PreservesFileContents()
    {
        CreateTestFile("rt-tgz/data.txt", "TarGz Round Trip");
        var archivePath = Path.Combine(_testDir, "rt.tar.gz");

        await _archiveService.CompressAsync(new CompressRequest
        {
            Paths = [Path.Combine(_testDir, "rt-tgz")],
            OutputPath = archivePath,
            Format = "tar.gz"
        });

        var destDir = Path.Combine(_testDir, "rt-tgz-out");
        await _archiveService.ExtractAsync(new ExtractRequest
        {
            ArchivePath = archivePath,
            DestinationPath = destDir
        });

        File.ReadAllText(Path.Combine(destDir, "rt-tgz", "data.txt")).Should().Be("TarGz Round Trip");
    }

    #endregion
}
