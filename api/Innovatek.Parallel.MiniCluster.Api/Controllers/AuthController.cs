using Innovatek.Parallel.Identity.Dtos;
using Innovatek.Parallel.Identity.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;

namespace Innovatek.Parallel.MiniCluster.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IAuthService authService, ILogger<AuthController> logger)
    {
        _authService = authService;
        _logger = logger;
    }

    /// <summary>
    /// Login with username and password
    /// </summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResult>> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { error = "Username and password are required" });
        }

        var result = await _authService.LoginAsync(request.Username, request.Password);

        if (!result.Success)
        {
            return Unauthorized(new { error = result.Error });
        }

        // Set refresh token in HttpOnly cookie
        SetRefreshTokenCookie(result.RefreshToken!);

        return Ok(result);
    }

    /// <summary>
    /// Refresh access token using refresh token
    /// </summary>
    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResult>> Refresh([FromBody] RefreshRequest? request = null)
    {
        // Try to get refresh token from cookie first, then from body
        var refreshToken = Request.Cookies["refreshToken"] ?? request?.RefreshToken;

        if (string.IsNullOrEmpty(refreshToken))
        {
            return BadRequest(new { error = "Refresh token is required" });
        }

        var result = await _authService.RefreshTokenAsync(refreshToken);

        if (!result.Success)
        {
            // Clear the cookie if token is invalid
            Response.Cookies.Delete("refreshToken");
            return Unauthorized(new { error = result.Error });
        }

        // Set new refresh token in cookie
        SetRefreshTokenCookie(result.RefreshToken!);

        return Ok(result);
    }

    /// <summary>
    /// Logout and revoke refresh token
    /// </summary>
    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        var refreshToken = Request.Cookies["refreshToken"];

        if (!string.IsNullOrEmpty(refreshToken))
        {
            await _authService.RevokeTokenAsync(refreshToken);
        }

        Response.Cookies.Delete("refreshToken");

        return Ok(new { message = "Logged out successfully" });
    }

    /// <summary>
    /// Get current authenticated user info
    /// </summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserDto>> GetCurrentUser()
    {
        var user = await _authService.GetCurrentUserAsync(User);

        if (user == null)
        {
            return Unauthorized(new { error = "User not found" });
        }

        return Ok(user);
    }

    /// <summary>
    /// Change password for current user
    /// </summary>
    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var user = await _authService.GetCurrentUserAsync(User);

        if (user == null)
        {
            return Unauthorized();
        }

        var success = await _authService.ChangePasswordAsync(user.Id, request.CurrentPassword, request.NewPassword);

        if (!success)
        {
            return BadRequest(new { error = "Invalid current password or unable to change password" });
        }

        // Clear refresh token cookie after password change
        Response.Cookies.Delete("refreshToken");

        return Ok(new { message = "Password changed successfully. Please login again." });
    }

    /// <summary>
    /// Get all users (Admin only)
    /// </summary>
    [HttpGet("users")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<List<UserDto>>> GetAllUsers()
    {
        var users = await _authService.GetAllUsersAsync();
        return Ok(users);
    }

    /// <summary>
    /// Create a new user (Admin only)
    /// </summary>
    [HttpPost("users")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<UserDto>> CreateUser([FromBody] CreateUserRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { error = "Username and password are required" });
        }

        var validRoles = new[] { "Admin", "Operator", "Viewer" };
        if (!validRoles.Contains(request.Role))
        {
            return BadRequest(new { error = "Invalid role. Must be Admin, Operator, or Viewer" });
        }

        var user = await _authService.CreateUserAsync(request.Username, request.Password, request.Role, request.Email);

        if (user == null)
        {
            return Conflict(new { error = "Username already exists" });
        }

        return CreatedAtAction(nameof(GetAllUsers), user);
    }

    /// <summary>
    /// Delete a user (Admin only)
    /// </summary>
    [HttpDelete("users/{userId}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteUser(Guid userId)
    {
        var success = await _authService.DeleteUserAsync(userId);

        if (!success)
        {
            return BadRequest(new { error = "Unable to delete user. User may not exist or be the last admin." });
        }

        return NoContent();
    }

    /// <summary>
    /// Update user role (Admin only)
    /// </summary>
    [HttpPatch("users/{userId}/role")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateUserRole(Guid userId, [FromBody] UpdateRoleRequest request)
    {
        var validRoles = new[] { "Admin", "Operator", "Viewer" };
        if (!validRoles.Contains(request.Role))
        {
            return BadRequest(new { error = "Invalid role. Must be Admin, Operator, or Viewer" });
        }

        var success = await _authService.UpdateUserRoleAsync(userId, request.Role);

        if (!success)
        {
            return BadRequest(new { error = "Unable to update role. User may not exist or be the last admin." });
        }

        return Ok(new { message = "Role updated successfully" });
    }

    /// <summary>
    /// Update user active status (Admin only)
    /// </summary>
    [HttpPatch("users/{userId}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateUserStatus(Guid userId, [FromBody] UpdateStatusRequest request)
    {
        var success = await _authService.UpdateUserStatusAsync(userId, request.IsActive);

        if (!success)
        {
            return BadRequest(new { error = "Unable to update status. User may not exist or be the last active admin." });
        }

        return Ok(new { message = "Status updated successfully" });
    }

    /// <summary>
    /// Reset a user's password (Admin only). Forces re-login by revoking all refresh tokens.
    /// </summary>
    [HttpPost("users/{userId}/reset-password")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ResetPassword(Guid userId, [FromBody] ResetPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
        {
            return BadRequest(new { error = "New password must be at least 6 characters" });
        }

        var success = await _authService.ResetPasswordAsync(userId, request.NewPassword);

        if (!success)
        {
            return BadRequest(new { error = "Unable to reset password. User may not exist." });
        }

        return Ok(new { message = "Password reset successfully. User must login again." });
    }

    private void SetRefreshTokenCookie(string refreshToken)
    {
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = Request.IsHttps,
            SameSite = SameSiteMode.Strict,
            Expires = DateTime.UtcNow.AddDays(7)
        };

        Response.Cookies.Append("refreshToken", refreshToken, cookieOptions);
    }
}

#region Request DTOs

public class LoginRequest
{
    [Required]
    public string Username { get; set; } = string.Empty;
    
    [Required]
    public string Password { get; set; } = string.Empty;
}

public class RefreshRequest
{
    public string? RefreshToken { get; set; }
}

public class ChangePasswordRequest
{
    [Required]
    public string CurrentPassword { get; set; } = string.Empty;
    
    [Required]
    [MinLength(6)]
    public string NewPassword { get; set; } = string.Empty;
}

public class CreateUserRequest
{
    [Required]
    public string Username { get; set; } = string.Empty;
    
    [Required]
    [MinLength(6)]
    public string Password { get; set; } = string.Empty;
    
    [Required]
    public string Role { get; set; } = "Operator";
    
    public string? Email { get; set; }
}

public class UpdateRoleRequest
{
    [Required]
    public string Role { get; set; } = string.Empty;
}

public class UpdateStatusRequest
{
    [Required]
    public bool IsActive { get; set; }
}

public class ResetPasswordRequest
{
    [Required]
    [MinLength(6)]
    public string NewPassword { get; set; } = string.Empty;
}

#endregion
