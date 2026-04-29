package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/innovatek/minicluster/internal/config"
	"github.com/innovatek/minicluster/internal/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// ─── DTOs ──────────────────────────────────────────────────────────────────

type LoginRequest struct {
	Username string `json:"username" validate:"required"`
	Password string `json:"password" validate:"required"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refreshToken" validate:"required"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"currentPassword" validate:"required"`
	NewPassword     string `json:"newPassword" validate:"required,min=6"`
}

type AuthResult struct {
	Success      bool      `json:"success"`
	AccessToken  string    `json:"accessToken,omitempty"`
	RefreshToken string    `json:"refreshToken,omitempty"`
	ExpiresAt    time.Time `json:"expiresAt,omitempty"`
	Error        string    `json:"error,omitempty"`
	User         *UserDto  `json:"user,omitempty"`
}

type UserDto struct {
	ID          string     `json:"id"`
	Username    string     `json:"username"`
	Email       string     `json:"email"`
	Role        models.Role `json:"role"`
	IsActive    bool       `json:"isActive"`
	CreatedAt   time.Time  `json:"createdAt"`
	LastLoginAt *time.Time `json:"lastLoginAt"`
}

type CreateUserRequest struct {
	Username string      `json:"username" validate:"required"`
	Email    string      `json:"email"`
	Password string      `json:"password" validate:"required,min=6"`
	Role     models.Role `json:"role" validate:"required"`
}

type UpdateUserRequest struct {
	Email string      `json:"email"`
	Role  models.Role `json:"role"`
}

// ─── Claims ────────────────────────────────────────────────────────────────

type Claims struct {
	UserID   string      `json:"sub"`
	Username string      `json:"name"`
	Role     models.Role `json:"role"`
	Email    string      `json:"email"`
	jwt.RegisteredClaims
}

// ─── Service ───────────────────────────────────────────────────────────────

type Service struct {
	db  *gorm.DB
	cfg *config.AuthConfig
}

func NewService(db *gorm.DB, cfg *config.AuthConfig) *Service {
	return &Service{db: db, cfg: cfg}
}

func (s *Service) Login(req LoginRequest) (*AuthResult, error) {
	var user models.User
	if err := s.db.Where("username = ? AND is_active = true", req.Username).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return &AuthResult{Success: false, Error: "Invalid credentials"}, nil
		}
		return nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return &AuthResult{Success: false, Error: "Invalid credentials"}, nil
	}

	// update last login
	now := time.Now().UTC()
	s.db.Model(&user).Update("last_login_at", now)

	// clean up old inactive tokens
	s.db.Where("user_id = ? AND (is_revoked = true OR expires_at < ?)", user.ID, now).
		Delete(&models.RefreshToken{})

	accessToken, expiresAt, err := s.generateAccessToken(&user)
	if err != nil {
		return nil, err
	}

	refreshToken, err := s.createRefreshToken(user.ID)
	if err != nil {
		return nil, err
	}

	return &AuthResult{
		Success:      true,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    expiresAt,
		User:         toUserDto(&user),
	}, nil
}

func (s *Service) RefreshToken(tokenStr string) (*AuthResult, error) {
	var rt models.RefreshToken
	err := s.db.Where("token = ?", tokenStr).First(&rt).Error
	if err != nil || !rt.IsActive || rt.IsRevoked || time.Now().After(rt.ExpiresAt) {
		// possible token reuse — revoke all tokens for this user if found
		if err == nil {
			s.db.Model(&models.RefreshToken{}).
				Where("user_id = ?", rt.UserID).
				Updates(map[string]any{"is_revoked": true, "revoked_at": time.Now().UTC()})
		}
		return &AuthResult{Success: false, Error: "Invalid or expired refresh token"}, nil
	}

	// revoke old token
	now := time.Now().UTC()
	s.db.Model(&rt).Updates(map[string]any{
		"is_active":  false,
		"is_revoked": true,
		"revoked_at": now,
	})

	var user models.User
	if err := s.db.First(&user, "id = ?", rt.UserID).Error; err != nil {
		return nil, err
	}

	accessToken, expiresAt, err := s.generateAccessToken(&user)
	if err != nil {
		return nil, err
	}

	newRefreshToken, err := s.createRefreshToken(user.ID)
	if err != nil {
		return nil, err
	}

	// record rotation chain
	s.db.Model(&rt).Updates(map[string]any{
		"replaced_by_token": newRefreshToken,
		"replaced_at":       now,
	})

	return &AuthResult{
		Success:      true,
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
		ExpiresAt:    expiresAt,
		User:         toUserDto(&user),
	}, nil
}

func (s *Service) RevokeToken(tokenStr string) bool {
	result := s.db.Model(&models.RefreshToken{}).
		Where("token = ?", tokenStr).
		Updates(map[string]any{
			"is_active":  false,
			"is_revoked": true,
			"revoked_at": time.Now().UTC(),
		})
	return result.RowsAffected > 0
}

func (s *Service) GetAllUsers() ([]UserDto, error) {
	var users []models.User
	if err := s.db.Find(&users).Error; err != nil {
		return nil, err
	}
	dtos := make([]UserDto, len(users))
	for i, u := range users {
		dtos[i] = *toUserDto(&u)
	}
	return dtos, nil
}

func (s *Service) GetUserByID(id string) (*UserDto, error) {
	var user models.User
	if err := s.db.First(&user, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return toUserDto(&user), nil
}

func (s *Service) CreateUser(req CreateUserRequest) (*UserDto, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	user := models.User{
		ID:           uuid.NewString(),
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: string(hash),
		Role:         req.Role,
		IsActive:     true,
		CreatedAt:    time.Now().UTC(),
	}
	if err := s.db.Create(&user).Error; err != nil {
		return nil, err
	}
	return toUserDto(&user), nil
}

func (s *Service) UpdateUser(id string, req UpdateUserRequest) (*UserDto, error) {
	var user models.User
	if err := s.db.First(&user, "id = ?", id).Error; err != nil {
		return nil, err
	}
	updates := map[string]any{}
	if req.Email != "" {
		updates["email"] = req.Email
	}
	if req.Role != "" {
		updates["role"] = req.Role
	}
	if err := s.db.Model(&user).Updates(updates).Error; err != nil {
		return nil, err
	}
	return toUserDto(&user), nil
}

func (s *Service) DeleteUser(id string) error {
	return s.db.Delete(&models.User{}, "id = ?", id).Error
}

func (s *Service) ChangePassword(userID, currentPassword, newPassword string) error {
	var user models.User
	if err := s.db.First(&user, "id = ?", userID).Error; err != nil {
		return err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(currentPassword)); err != nil {
		return errors.New("current password is incorrect")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return s.db.Model(&user).Update("password_hash", string(hash)).Error
}

// EnsureAdminUser creates a default admin if no users exist.
func (s *Service) EnsureAdminUser() error {
	var count int64
	s.db.Model(&models.User{}).Count(&count)
	if count > 0 {
		return nil
	}
	_, err := s.CreateUser(CreateUserRequest{
		Username: "admin",
		Email:    "admin@minicluster.local",
		Password: "admin",
		Role:     models.RoleAdmin,
	})
	return err
}

// ValidateToken parses and validates a JWT access token.
func (s *Service) ValidateToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(s.cfg.JwtSecret), nil
	}, jwt.WithIssuer(s.cfg.JwtIssuer), jwt.WithAudience(s.cfg.JwtAudience))
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

// ─── Internal helpers ──────────────────────────────────────────────────────

func (s *Service) generateAccessToken(user *models.User) (string, time.Time, error) {
	expiresAt := time.Now().UTC().Add(
		time.Duration(s.cfg.AccessTokenExpiryMinutes) * time.Minute,
	)
	claims := Claims{
		UserID:   user.ID,
		Username: user.Username,
		Role:     user.Role,
		Email:    user.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    s.cfg.JwtIssuer,
			Audience:  jwt.ClaimStrings{s.cfg.JwtAudience},
			Subject:   user.ID,
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now().UTC()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(s.cfg.JwtSecret))
	return signed, expiresAt, err
}

func (s *Service) createRefreshToken(userID string) (string, error) {
	token := uuid.NewString()
	rt := models.RefreshToken{
		ID:        uuid.NewString(),
		UserID:    userID,
		Token:     token,
		ExpiresAt: time.Now().UTC().AddDate(0, 0, s.cfg.RefreshTokenExpiryDays),
		CreatedAt: time.Now().UTC(),
		IsActive:  true,
	}
	if err := s.db.Create(&rt).Error; err != nil {
		return "", err
	}
	return token, nil
}

func toUserDto(u *models.User) *UserDto {
	return &UserDto{
		ID:          u.ID,
		Username:    u.Username,
		Email:       u.Email,
		Role:        u.Role,
		IsActive:    u.IsActive,
		CreatedAt:   u.CreatedAt,
		LastLoginAt: u.LastLoginAt,
	}
}
