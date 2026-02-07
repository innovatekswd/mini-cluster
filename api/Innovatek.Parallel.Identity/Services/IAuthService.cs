using Innovatek.Parallel.Identity.Dtos;
using System.Security.Claims;

namespace Innovatek.Parallel.Identity.Services;

public interface IAuthService
{
    Task<AuthResult> LoginAsync(string username, string password);
    Task<AuthResult> RefreshTokenAsync(string refreshToken);
    Task<bool> RevokeTokenAsync(string refreshToken);
    Task<UserDto?> GetCurrentUserAsync(ClaimsPrincipal principal);
    Task<bool> CreateInitialAdminIfNeededAsync();
    Task<bool> ChangePasswordAsync(Guid userId, string currentPassword, string newPassword);
    Task<List<UserDto>> GetAllUsersAsync();
    Task<UserDto?> CreateUserAsync(string username, string password, string role, string? email = null);
    Task<bool> DeleteUserAsync(Guid userId);
    Task<bool> UpdateUserRoleAsync(Guid userId, string role);
    Task<bool> UpdateUserStatusAsync(Guid userId, bool isActive);
    Task<bool> ResetPasswordAsync(Guid userId, string newPassword);
}
