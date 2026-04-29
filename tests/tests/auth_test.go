package tests

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ─── DTOs ──────────────────────────────────────────────────────────────────

type AuthResultDto struct {
	Success      bool   `json:"success"`
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	Error        string `json:"error"`
}

type UserDto struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Role     string `json:"role"`
	IsActive bool   `json:"isActive"`
}

// ─── Tests ─────────────────────────────────────────────────────────────────

func TestAuthLogin(t *testing.T) {
	ctx := context.Background()

	var result AuthResultDto
	err := apiClient.Post(ctx, "/api/auth/login", map[string]string{
		"username": "admin",
		"password": "admin",
	}, &result)
	require.NoError(t, err)
	assert.True(t, result.Success, "Login should succeed")
	assert.NotEmpty(t, result.AccessToken, "Access token should not be empty")
}

func TestAuthLoginBadPassword(t *testing.T) {
	ctx := context.Background()

	var result AuthResultDto
	err := apiClient.Post(ctx, "/api/auth/login", map[string]string{
		"username": "admin",
		"password": "wrongpassword",
	}, &result)
	// Expect a 401 error or result.Success == false
	if err == nil {
		assert.False(t, result.Success, "Login with wrong password should fail")
	} else {
		assert.Contains(t, err.Error(), "401", "Should return 401 for bad password")
	}
}

func TestAuthMe(t *testing.T) {
	ctx := context.Background()

	var user UserDto
	err := apiClient.Get(ctx, "/api/auth/me", &user)
	require.NoError(t, err)
	assert.NotEmpty(t, user.ID, "User ID should not be empty")
	assert.Equal(t, "admin", user.Username)
}

func TestAuthTokenRefresh(t *testing.T) {
	ctx := context.Background()

	// Login to get refresh token
	var loginResult AuthResultDto
	err := apiClient.Post(ctx, "/api/auth/login", map[string]string{
		"username": "admin",
		"password": "admin",
	}, &loginResult)
	require.NoError(t, err)
	require.NotEmpty(t, loginResult.RefreshToken)

	// Refresh the token
	var refreshResult AuthResultDto
	err = apiClient.Post(ctx, "/api/auth/refresh", map[string]string{
		"refreshToken": loginResult.RefreshToken,
	}, &refreshResult)
	require.NoError(t, err)
	assert.True(t, refreshResult.Success, "Token refresh should succeed")
	assert.NotEmpty(t, refreshResult.AccessToken, "New access token should not be empty")
}

func TestAuthUserCRUD(t *testing.T) {
	ctx := context.Background()

	username := "testuser-" + randomString(8)

	// Create a new user
	var created UserDto
	err := apiClient.Post(ctx, "/api/auth/users", map[string]interface{}{
		"username": username,
		"email":    username + "@example.com",
		"password": "password123",
		"role":     "viewer",
	}, &created)
	require.NoError(t, err)
	assert.Equal(t, username, created.Username)
	assert.NotEmpty(t, created.ID)

	// List users — should include the new one
	var users []UserDto
	err = apiClient.Get(ctx, "/api/auth/users", &users)
	require.NoError(t, err)
	found := false
	for _, u := range users {
		if u.Username == username {
			found = true
			break
		}
	}
	assert.True(t, found, "Created user should appear in list")

	// Update user
	var updated UserDto
	err = apiClient.Put(ctx, "/api/auth/users/"+created.ID, map[string]interface{}{
		"email": "updated@example.com",
		"role":  "viewer",
	}, &updated)
	require.NoError(t, err)

	// Delete user
	err = apiClient.Delete(ctx, "/api/auth/users/"+created.ID)
	require.NoError(t, err)

	// Verify deleted
	var usersAfter []UserDto
	err = apiClient.Get(ctx, "/api/auth/users", &usersAfter)
	require.NoError(t, err)
	for _, u := range usersAfter {
		assert.NotEqual(t, username, u.Username, "Deleted user should not appear")
	}
}
