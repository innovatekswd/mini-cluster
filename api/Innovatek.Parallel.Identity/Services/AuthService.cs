using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Innovatek.Parallel.Identity.Dtos;
using Innovatek.Parallel.Identity.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Innovatek.Parallel.Identity.Services;

public class AuthService : IAuthService
{
    private readonly IIdentityDbContext _db;
    private readonly AuthenticationOptions _options;
    private readonly ILogger<AuthService> _logger;

    public AuthService(
        IIdentityDbContext db,
        IOptions<AuthenticationOptions> options,
        ILogger<AuthService> logger)
    {
        _db = db;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<AuthResult> LoginAsync(string username, string password)
    {
        try
        {
            var user = await _db.Users
                .Include(u => u.RefreshTokens)
                .FirstOrDefaultAsync(u => u.Username == username && u.IsActive);

            if (user == null)
            {
                _logger.LogWarning("Login failed: User '{Username}' not found", username);
                return new AuthResult { Success = false, Error = "Invalid username or password" };
            }

            if (!VerifyPassword(password, user.PasswordHash))
            {
                _logger.LogWarning("Login failed: Invalid password for user '{Username}'", username);
                return new AuthResult { Success = false, Error = "Invalid username or password" };
            }

            // Update last login
            user.LastLoginAt = DateTime.UtcNow;

            // Generate tokens
            var accessToken = GenerateAccessToken(user);
            var refreshToken = GenerateRefreshToken();

            // Save refresh token
            var refreshTokenEntity = new RefreshToken
            {
                UserId = user.Id,
                Token = refreshToken,
                ExpiresAt = DateTime.UtcNow.AddDays(_options.RefreshTokenExpiryDays),
                CreatedAt = DateTime.UtcNow
            };
            
            // Remove old inactive tokens (cleanup)
            var oldTokens = user.RefreshTokens.Where(t => !t.IsActive).ToList();
            foreach (var oldToken in oldTokens)
            {
                _db.RefreshTokens.Remove(oldToken);
            }

            _db.RefreshTokens.Add(refreshTokenEntity);
            await _db.SaveChangesAsync();

            _logger.LogInformation("User '{Username}' logged in successfully", username);

            return new AuthResult
            {
                Success = true,
                AccessToken = accessToken,
                RefreshToken = refreshToken,
                ExpiresAt = DateTime.UtcNow.AddMinutes(_options.AccessTokenExpiryMinutes),
                User = new UserDto
                {
                    Id = user.Id,
                    Username = user.Username,
                    Email = user.Email,
                    Role = user.Role
                }
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during login for user '{Username}'", username);
            return new AuthResult { Success = false, Error = "An error occurred during login" };
        }
    }

    public async Task<AuthResult> RefreshTokenAsync(string refreshToken)
    {
        try
        {
            var token = await _db.RefreshTokens
                .Include(t => t.User)
                .FirstOrDefaultAsync(t => t.Token == refreshToken);

            if (token == null)
            {
                return new AuthResult { Success = false, Error = "Invalid refresh token" };
            }

            if (!token.IsActive)
            {
                // Token has been revoked or expired - revoke all descendant tokens
                await RevokeDescendantRefreshTokensAsync(token, "Attempted reuse of revoked token");
                return new AuthResult { Success = false, Error = "Invalid refresh token" };
            }

            if (token.User == null || !token.User.IsActive)
            {
                return new AuthResult { Success = false, Error = "User account is disabled" };
            }

            // Rotate refresh token
            var newRefreshToken = RotateRefreshToken(token);
            _db.RefreshTokens.Add(newRefreshToken);

            // Remove old inactive tokens (cleanup)
            var oldTokens = await _db.RefreshTokens
                .Where(t => t.UserId == token.UserId && !t.IsRevoked && t.ExpiresAt <= DateTime.UtcNow)
                .ToListAsync();
            foreach (var oldToken in oldTokens)
            {
                _db.RefreshTokens.Remove(oldToken);
            }

            await _db.SaveChangesAsync();

            var accessToken = GenerateAccessToken(token.User);

            return new AuthResult
            {
                Success = true,
                AccessToken = accessToken,
                RefreshToken = newRefreshToken.Token,
                ExpiresAt = DateTime.UtcNow.AddMinutes(_options.AccessTokenExpiryMinutes),
                User = new UserDto
                {
                    Id = token.User.Id,
                    Username = token.User.Username,
                    Email = token.User.Email,
                    Role = token.User.Role
                }
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during token refresh");
            return new AuthResult { Success = false, Error = "An error occurred during token refresh" };
        }
    }

    public async Task<bool> RevokeTokenAsync(string refreshToken)
    {
        try
        {
            var token = await _db.RefreshTokens.FirstOrDefaultAsync(t => t.Token == refreshToken);
            
            if (token == null || !token.IsActive)
            {
                return false;
            }

            token.IsRevoked = true;
            token.RevokedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error revoking token");
            return false;
        }
    }

    public async Task<UserDto?> GetCurrentUserAsync(ClaimsPrincipal principal)
    {
        var userIdClaim = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            return null;
        }

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        
        if (user == null || !user.IsActive)
        {
            return null;
        }

        return new UserDto
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            Role = user.Role
        };
    }

    public async Task<bool> CreateInitialAdminIfNeededAsync()
    {
        try
        {
            if (await _db.Users.AnyAsync())
            {
                return false; // Users already exist
            }

            var adminUser = new User
            {
                Username = "admin",
                PasswordHash = HashPassword("admin"), // Default password - should be changed!
                Role = "Admin",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _db.Users.Add(adminUser);
            await _db.SaveChangesAsync();

            _logger.LogWarning("Created initial admin user with default password. Please change it immediately!");
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating initial admin user");
            return false;
        }
    }

    public async Task<bool> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword)
    {
        try
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
            
            if (user == null)
            {
                return false;
            }

            if (!VerifyPassword(currentPassword, user.PasswordHash))
            {
                return false;
            }

            user.PasswordHash = HashPassword(newPassword);
            await _db.SaveChangesAsync();

            // Revoke all refresh tokens for this user
            var tokens = await _db.RefreshTokens.Where(t => t.UserId == userId && t.IsActive).ToListAsync();
            foreach (var token in tokens)
            {
                token.IsRevoked = true;
                token.RevokedAt = DateTime.UtcNow;
            }
            await _db.SaveChangesAsync();

            _logger.LogInformation("Password changed for user {UserId}", userId);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error changing password for user {UserId}", userId);
            return false;
        }
    }

    public async Task<List<UserDto>> GetAllUsersAsync()
    {
        return await _db.Users
            .Select(u => new UserDto
            {
                Id = u.Id,
                Username = u.Username,
                Email = u.Email,
                Role = u.Role,
                IsActive = u.IsActive,
                CreatedAt = u.CreatedAt,
                LastLoginAt = u.LastLoginAt
            })
            .ToListAsync();
    }

    public async Task<UserDto?> CreateUserAsync(string username, string password, string role, string? email = null)
    {
        try
        {
            if (await _db.Users.AnyAsync(u => u.Username == username))
            {
                return null; // User already exists
            }

            var user = new User
            {
                Username = username,
                PasswordHash = HashPassword(password),
                Role = role,
                Email = email,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            return new UserDto
            {
                Id = user.Id,
                Username = user.Username,
                Email = user.Email,
                Role = user.Role,
                IsActive = user.IsActive,
                CreatedAt = user.CreatedAt,
                LastLoginAt = user.LastLoginAt
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating user '{Username}'", username);
            return null;
        }
    }

    public async Task<bool> DeleteUserAsync(Guid userId)
    {
        try
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
            
            if (user == null)
            {
                return false;
            }

            // Don't allow deleting the last admin
            if (user.Role == "Admin")
            {
                var adminCount = await _db.Users.CountAsync(u => u.Role == "Admin" && u.IsActive);
                if (adminCount <= 1)
                {
                    return false;
                }
            }

            // Remove all refresh tokens
            var tokens = await _db.RefreshTokens.Where(t => t.UserId == userId).ToListAsync();
            foreach (var token in tokens)
            {
                _db.RefreshTokens.Remove(token);
            }

            _db.Users.Remove(user);
            await _db.SaveChangesAsync();

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting user {UserId}", userId);
            return false;
        }
    }

    public async Task<bool> UpdateUserRoleAsync(Guid userId, string role)
    {
        try
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
            
            if (user == null)
            {
                return false;
            }

            // Don't allow demoting the last admin
            if (user.Role == "Admin" && role != "Admin")
            {
                var adminCount = await _db.Users.CountAsync(u => u.Role == "Admin" && u.IsActive);
                if (adminCount <= 1)
                {
                    return false;
                }
            }

            user.Role = role;
            await _db.SaveChangesAsync();

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating role for user {UserId}", userId);
            return false;
        }
    }

    public async Task<bool> UpdateUserStatusAsync(Guid userId, bool isActive)
    {
        try
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
            
            if (user == null)
            {
                return false;
            }

            // Don't allow deactivating the last active admin
            if (!isActive && user.Role == "Admin")
            {
                var activeAdminCount = await _db.Users.CountAsync(u => u.Role == "Admin" && u.IsActive);
                if (activeAdminCount <= 1)
                {
                    return false;
                }
            }

            user.IsActive = isActive;
            await _db.SaveChangesAsync();

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating status for user {UserId}", userId);
            return false;
        }
    }

    #region Private Methods

    private string GenerateAccessToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.JwtSecret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        if (!string.IsNullOrEmpty(user.Email))
        {
            claims.Add(new Claim(ClaimTypes.Email, user.Email));
        }

        var token = new JwtSecurityToken(
            issuer: _options.JwtIssuer,
            audience: _options.JwtAudience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_options.AccessTokenExpiryMinutes),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string GenerateRefreshToken()
    {
        var randomBytes = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomBytes);
        return Convert.ToBase64String(randomBytes);
    }

    private RefreshToken RotateRefreshToken(RefreshToken oldToken)
    {
        var newToken = new RefreshToken
        {
            UserId = oldToken.UserId,
            Token = GenerateRefreshToken(),
            ExpiresAt = DateTime.UtcNow.AddDays(_options.RefreshTokenExpiryDays),
            CreatedAt = DateTime.UtcNow
        };

        oldToken.IsRevoked = true;
        oldToken.RevokedAt = DateTime.UtcNow;
        oldToken.ReplacedByToken = newToken.Token;

        return newToken;
    }

    private async Task RevokeDescendantRefreshTokensAsync(RefreshToken token, string reason)
    {
        if (!string.IsNullOrEmpty(token.ReplacedByToken))
        {
            var childToken = await _db.RefreshTokens
                .FirstOrDefaultAsync(t => t.Token == token.ReplacedByToken);

            if (childToken != null)
            {
                if (childToken.IsActive)
                {
                    childToken.IsRevoked = true;
                    childToken.RevokedAt = DateTime.UtcNow;
                }
                await RevokeDescendantRefreshTokensAsync(childToken, reason);
            }
        }
    }

    private static string HashPassword(string password)
    {
        return BCrypt.Net.BCrypt.HashPassword(password, BCrypt.Net.BCrypt.GenerateSalt(12));
    }

    private static bool VerifyPassword(string password, string hash)
    {
        return BCrypt.Net.BCrypt.Verify(password, hash);
    }

    #endregion
}
