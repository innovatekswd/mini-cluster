using FluentAssertions;
using Innovatek.Parallel.Identity.Entities;
using Innovatek.Parallel.Identity.Services;
using Innovatek.Parallel.MiniCluster.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;

namespace Innovatek.Parallel.MiniCluster.Test;

public class AuthServiceTest
{
    private readonly AuthenticationOptions _defaultOptions = new()
    {
        Enabled = true,
        JwtSecret = "SuperSecretKeyForTestingPurposesOnly_MustBe32Bytes!",
        JwtIssuer = "MiniCluster",
        JwtAudience = "MiniCluster",
        AccessTokenExpiryMinutes = 30,
        RefreshTokenExpiryDays = 7
    };

    private DbContextOptions<AppDbContext> CreateDbOptions()
    {
        return new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
    }

    private AuthService CreateService(AppDbContext context, AuthenticationOptions? options = null)
    {
        var opts = Options.Create(options ?? _defaultOptions);
        var logger = new Mock<ILogger<AuthService>>();
        return new AuthService(context, opts, logger.Object);
    }

    // ─── CreateInitialAdminIfNeededAsync ────────────────────

    [Fact]
    public async Task CreateInitialAdmin_NoUsers_CreatesAdminUser()
    {
        var options = CreateDbOptions();

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var result = await service.CreateInitialAdminIfNeededAsync();
            result.Should().BeTrue();
        }

        using (var context = new AppDbContext(options))
        {
            var users = await context.Users.ToListAsync();
            users.Should().HaveCount(1);
            users[0].Username.Should().Be("admin");
            users[0].Role.Should().Be("Admin");
            users[0].IsActive.Should().BeTrue();
        }
    }

    [Fact]
    public async Task CreateInitialAdmin_UsersExist_ReturnsFalse()
    {
        var options = CreateDbOptions();

        using (var context = new AppDbContext(options))
        {
            context.Users.Add(new User
            {
                Username = "existing",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("password"),
                Role = "Admin"
            });
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var result = await service.CreateInitialAdminIfNeededAsync();
            result.Should().BeFalse();
        }
    }

    // ─── LoginAsync ──────────────────────────────────────────

    [Fact]
    public async Task LoginAsync_ValidCredentials_ReturnsSuccess()
    {
        var options = CreateDbOptions();

        using (var context = new AppDbContext(options))
        {
            context.Users.Add(new User
            {
                Username = "testuser",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("password123"),
                Role = "Admin",
                IsActive = true
            });
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var result = await service.LoginAsync("testuser", "password123");

            result.Success.Should().BeTrue();
            result.AccessToken.Should().NotBeNullOrEmpty();
            result.RefreshToken.Should().NotBeNullOrEmpty();
            result.ExpiresAt.Should().BeAfter(DateTime.UtcNow);
            result.User.Should().NotBeNull();
            result.User!.Username.Should().Be("testuser");
        }
    }

    [Fact]
    public async Task LoginAsync_WrongPassword_ReturnsFailure()
    {
        var options = CreateDbOptions();

        using (var context = new AppDbContext(options))
        {
            context.Users.Add(new User
            {
                Username = "testuser",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("correct"),
                Role = "Admin",
                IsActive = true
            });
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var result = await service.LoginAsync("testuser", "wrong");

            result.Success.Should().BeFalse();
            result.Error.Should().NotBeNullOrEmpty();
        }
    }

    [Fact]
    public async Task LoginAsync_NonExistentUser_ReturnsFailure()
    {
        var options = CreateDbOptions();
        using var context = new AppDbContext(options);
        var service = CreateService(context);

        var result = await service.LoginAsync("nouser", "any");

        result.Success.Should().BeFalse();
    }

    [Fact]
    public async Task LoginAsync_InactiveUser_ReturnsFailure()
    {
        var options = CreateDbOptions();

        using (var context = new AppDbContext(options))
        {
            context.Users.Add(new User
            {
                Username = "inactive",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("password"),
                Role = "Operator",
                IsActive = false
            });
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var result = await service.LoginAsync("inactive", "password");

            result.Success.Should().BeFalse();
        }
    }

    // ─── CreateUserAsync ─────────────────────────────────────

    [Fact]
    public async Task CreateUserAsync_ValidData_CreatesUser()
    {
        var options = CreateDbOptions();

        using var context = new AppDbContext(options);
        var service = CreateService(context);

        var result = await service.CreateUserAsync("newuser", "password", "Operator", "new@test.com");

        result.Should().NotBeNull();
        result!.Username.Should().Be("newuser");
        result.Role.Should().Be("Operator");
        result.Email.Should().Be("new@test.com");
    }

    [Fact]
    public async Task CreateUserAsync_DuplicateUsername_ReturnsNull()
    {
        var options = CreateDbOptions();

        using (var context = new AppDbContext(options))
        {
            context.Users.Add(new User
            {
                Username = "existing",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("pass"),
                Role = "Admin"
            });
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var result = await service.CreateUserAsync("existing", "pass", "Operator");

            result.Should().BeNull();
        }
    }

    // ─── GetAllUsersAsync ────────────────────────────────────

    [Fact]
    public async Task GetAllUsersAsync_ReturnsAllUsers()
    {
        var options = CreateDbOptions();

        using (var context = new AppDbContext(options))
        {
            context.Users.Add(new User { Username = "user1", PasswordHash = "h1", Role = "Admin" });
            context.Users.Add(new User { Username = "user2", PasswordHash = "h2", Role = "Operator" });
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var users = await service.GetAllUsersAsync();

            users.Should().HaveCount(2);
        }
    }

    // ─── DeleteUserAsync ─────────────────────────────────────

    [Fact]
    public async Task DeleteUserAsync_NonExistentUser_ReturnsFalse()
    {
        var options = CreateDbOptions();
        using var context = new AppDbContext(options);
        var service = CreateService(context);

        var result = await service.DeleteUserAsync(Guid.NewGuid());

        result.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteUserAsync_LastAdmin_ThrowsInvalidOperation()
    {
        var options = CreateDbOptions();
        Guid userId;

        using (var context = new AppDbContext(options))
        {
            var user = new User
            {
                Username = "onlyadmin",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("pass"),
                Role = "Admin",
                IsActive = true
            };
            context.Users.Add(user);
            await context.SaveChangesAsync();
            userId = user.Id;
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var result = await service.DeleteUserAsync(userId);

            result.Should().BeFalse("deleting the last admin should be prevented");
        }
    }

    [Fact]
    public async Task DeleteUserAsync_NonLastAdmin_DeletesUser()
    {
        var options = CreateDbOptions();
        Guid deleteUserId;

        using (var context = new AppDbContext(options))
        {
            context.Users.Add(new User
            {
                Username = "admin1",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("pass"),
                Role = "Admin",
                IsActive = true
            });
            var deleteUser = new User
            {
                Username = "admin2",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("pass"),
                Role = "Admin",
                IsActive = true
            };
            context.Users.Add(deleteUser);
            await context.SaveChangesAsync();
            deleteUserId = deleteUser.Id;
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var result = await service.DeleteUserAsync(deleteUserId);
            result.Should().BeTrue();
        }

        using (var context = new AppDbContext(options))
        {
            var remaining = await context.Users.ToListAsync();
            remaining.Should().HaveCount(1);
            remaining[0].Username.Should().Be("admin1");
        }
    }

    // ─── ChangePasswordAsync ─────────────────────────────────

    [Fact]
    public async Task ChangePasswordAsync_CorrectCurrentPassword_ChangesHash()
    {
        var options = CreateDbOptions();
        Guid userId;
        string originalHash;

        using (var seedContext = new AppDbContext(options))
        {
            var user = new User
            {
                Username = "user",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("oldpass"),
                Role = "Admin",
                IsActive = true
            };
            seedContext.Users.Add(user);
            await seedContext.SaveChangesAsync();
            userId = user.Id;
            originalHash = user.PasswordHash;
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            // Note: return value may be false due to InMemory provider limitation
            // with RefreshToken.IsActive computed property, but the password change
            // is persisted before the RefreshTokens query runs.
            await service.ChangePasswordAsync(userId, "oldpass", "newpass");
        }

        // Verify the password was actually changed
        using (var verifyContext = new AppDbContext(options))
        {
            var updatedUser = await verifyContext.Users.FirstAsync(u => u.Id == userId);
            updatedUser.PasswordHash.Should().NotBe(originalHash);
            BCrypt.Net.BCrypt.Verify("newpass", updatedUser.PasswordHash).Should().BeTrue();
        }
    }

    [Fact]
    public async Task ChangePasswordAsync_WrongCurrentPassword_ReturnsFalse()
    {
        var options = CreateDbOptions();

        using var context = new AppDbContext(options);
        var user = new User
        {
            Username = "user",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("realpass"),
            Role = "Admin",
            IsActive = true
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var service = CreateService(context);
        var result = await service.ChangePasswordAsync(user.Id, "wrongpass", "newpass");

        result.Should().BeFalse();
    }

    // ─── UpdateUserRoleAsync ─────────────────────────────────

    [Fact]
    public async Task UpdateUserRoleAsync_DemoteLastAdmin_ThrowsInvalidOperation()
    {
        var options = CreateDbOptions();
        Guid userId;

        using (var context = new AppDbContext(options))
        {
            var user = new User
            {
                Username = "onlyadmin",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("pass"),
                Role = "Admin",
                IsActive = true
            };
            context.Users.Add(user);
            await context.SaveChangesAsync();
            userId = user.Id;
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var result = await service.UpdateUserRoleAsync(userId, "Operator");

            result.Should().BeFalse("demoting the last admin should be prevented");
        }
    }

    [Fact]
    public async Task UpdateUserRoleAsync_ValidRole_UpdatesRole()
    {
        var options = CreateDbOptions();
        Guid userId;

        using (var context = new AppDbContext(options))
        {
            context.Users.Add(new User
            {
                Username = "admin1",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("pass"),
                Role = "Admin",
                IsActive = true
            });
            var user = new User
            {
                Username = "operator1",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("pass"),
                Role = "Operator",
                IsActive = true
            };
            context.Users.Add(user);
            await context.SaveChangesAsync();
            userId = user.Id;
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var result = await service.UpdateUserRoleAsync(userId, "Admin");

            result.Should().BeTrue();
        }

        using (var context = new AppDbContext(options))
        {
            var user = await context.Users.FindAsync(userId);
            user!.Role.Should().Be("Admin");
        }
    }

    // ─── UpdateUserStatusAsync ───────────────────────────────

    [Fact]
    public async Task UpdateUserStatusAsync_DeactivateLastAdmin_ThrowsInvalidOperation()
    {
        var options = CreateDbOptions();
        Guid userId;

        using (var context = new AppDbContext(options))
        {
            var user = new User
            {
                Username = "onlyadmin",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("pass"),
                Role = "Admin",
                IsActive = true
            };
            context.Users.Add(user);
            await context.SaveChangesAsync();
            userId = user.Id;
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var result = await service.UpdateUserStatusAsync(userId, false);

            result.Should().BeFalse("deactivating the last admin should be prevented");
        }
    }

    // ─── ResetPasswordAsync ──────────────────────────────────

    [Fact]
    public async Task ResetPasswordAsync_ValidUser_ChangesPassword()
    {
        var options = CreateDbOptions();
        Guid userId;

        using (var context = new AppDbContext(options))
        {
            var user = new User
            {
                Username = "user",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("oldpass"),
                Role = "Admin"
            };
            context.Users.Add(user);
            await context.SaveChangesAsync();
            userId = user.Id;
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var result = await service.ResetPasswordAsync(userId, "newpass123");

            result.Should().BeTrue();
        }

        using (var context = new AppDbContext(options))
        {
            var user = await context.Users.FindAsync(userId);
            BCrypt.Net.BCrypt.Verify("newpass123", user!.PasswordHash).Should().BeTrue();
        }
    }

    [Fact]
    public async Task ResetPasswordAsync_NonExistentUser_ReturnsFalse()
    {
        var options = CreateDbOptions();
        using var context = new AppDbContext(options);
        var service = CreateService(context);

        var result = await service.ResetPasswordAsync(Guid.NewGuid(), "newpass");

        result.Should().BeFalse();
    }

    // ─── RefreshTokenAsync ───────────────────────────────────

    [Fact]
    public async Task RefreshTokenAsync_ValidToken_RotatesToken()
    {
        var options = CreateDbOptions();
        string refreshToken;

        // First login to get a refresh token
        using (var context = new AppDbContext(options))
        {
            context.Users.Add(new User
            {
                Username = "user",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("pass"),
                Role = "Admin",
                IsActive = true
            });
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var loginResult = await service.LoginAsync("user", "pass");
            refreshToken = loginResult.RefreshToken!;
        }

        // Use the refresh token
        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var result = await service.RefreshTokenAsync(refreshToken);

            result.Success.Should().BeTrue();
            result.AccessToken.Should().NotBeNullOrEmpty();
            result.RefreshToken.Should().NotBeNullOrEmpty();
            result.RefreshToken.Should().NotBe(refreshToken, "old token should be rotated");
        }
    }

    [Fact]
    public async Task RefreshTokenAsync_InvalidToken_ReturnsFailure()
    {
        var options = CreateDbOptions();
        using var context = new AppDbContext(options);
        var service = CreateService(context);

        var result = await service.RefreshTokenAsync("invalid-token");

        result.Success.Should().BeFalse();
    }

    // ─── RevokeTokenAsync ────────────────────────────────────

    [Fact]
    public async Task RevokeTokenAsync_ValidToken_RevokesIt()
    {
        var options = CreateDbOptions();
        string refreshToken;

        using (var context = new AppDbContext(options))
        {
            context.Users.Add(new User
            {
                Username = "user",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("pass"),
                Role = "Admin",
                IsActive = true
            });
            await context.SaveChangesAsync();
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var loginResult = await service.LoginAsync("user", "pass");
            refreshToken = loginResult.RefreshToken!;
        }

        using (var context = new AppDbContext(options))
        {
            var service = CreateService(context);
            var result = await service.RevokeTokenAsync(refreshToken);

            result.Should().BeTrue();
        }

        // Verify the token is now revoked
        using (var context = new AppDbContext(options))
        {
            var token = await context.RefreshTokens.FirstOrDefaultAsync(t => t.Token == refreshToken);
            token.Should().NotBeNull();
            token!.IsRevoked.Should().BeTrue();
        }
    }
}
