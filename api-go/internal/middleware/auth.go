package middleware

import (
	"context"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/innovatek/minicluster/internal/auth"
	"github.com/innovatek/minicluster/internal/models"
)

// ─── Context keys ──────────────────────────────────────────────────────────

type contextKey string

const (
	ClaimsKey  contextKey = "claims"
	MachineKey contextKey = "agent_machine"
)

func GetClaims(r *http.Request) *auth.Claims {
	if v := r.Context().Value(ClaimsKey); v != nil {
		return v.(*auth.Claims)
	}
	return nil
}

func GetMachine(r *http.Request) *models.Machine {
	if v := r.Context().Value(MachineKey); v != nil {
		return v.(*models.Machine)
	}
	return nil
}

// ─── JWT Auth ──────────────────────────────────────────────────────────────

// JWTAuth extracts and validates the Bearer token (or access_token query param for SignalR).
func JWTAuth(svc *auth.Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenStr := extractToken(r)
			if tokenStr == "" {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			claims, err := svc.ValidateToken(tokenStr)
			if err != nil {
				http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
				return
			}
			ctx := context.WithValue(r.Context(), ClaimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// JWTAuthOptional validates token if present but does not reject missing tokens.
func JWTAuthOptional(svc *auth.Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenStr := extractToken(r)
			if tokenStr != "" {
				if claims, err := svc.ValidateToken(tokenStr); err == nil {
					ctx := context.WithValue(r.Context(), ClaimsKey, claims)
					r = r.WithContext(ctx)
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

// AuthBypass injects an Admin identity when authentication is disabled.
func AuthBypass(enabled bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !enabled && GetClaims(r) == nil {
				ctx := context.WithValue(r.Context(), ClaimsKey, &auth.Claims{
					UserID:   "bypass",
					Username: "admin",
					Role:     models.RoleAdmin,
				})
				r = r.WithContext(ctx)
			}
			next.ServeHTTP(w, r)
		})
	}
}

// ─── Role enforcement ──────────────────────────────────────────────────────

// RequireRole rejects requests where the authenticated role is not in the allowed set.
func RequireRole(roles ...models.Role) func(http.Handler) http.Handler {
	allowed := make(map[models.Role]bool, len(roles))
	for _, r := range roles {
		allowed[r] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := GetClaims(r)
			if claims == nil {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			if !allowed[claims.Role] {
				http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RoleBasedAccess enforces role hierarchy on /api/* paths:
//   - Viewer: GET/HEAD only
//   - Operator: no /api/auth/users write + no settings write
//   - Admin: full access
func RoleBasedAccess(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if !strings.HasPrefix(path, "/api/") {
			next.ServeHTTP(w, r)
			return
		}

		claims := GetClaims(r)
		if claims == nil {
			next.ServeHTTP(w, r)
			return
		}

		switch claims.Role {
		case models.RoleViewer:
			if r.Method != http.MethodGet && r.Method != http.MethodHead {
				http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
				return
			}
		case models.RoleOperator:
			// No user management writes
			if strings.HasPrefix(path, "/api/auth/users") &&
				r.Method != http.MethodGet && r.Method != http.MethodHead {
				http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
				return
			}
			// No settings write
			if strings.HasPrefix(path, "/api/settings") &&
				(r.Method == http.MethodPut || r.Method == http.MethodPost || r.Method == http.MethodDelete) {
				http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

// ─── Rate limiting ─────────────────────────────────────────────────────────

type rateLimitEntry struct {
	count     int
	windowEnd time.Time
}

var (
	rateLimitMu      sync.Mutex
	rateLimitBuckets = map[string]*rateLimitEntry{}
	lastCleanup      = time.Now()
)

// LoginRateLimit limits /api/auth/login to 5 attempts per minute per IP.
func LoginRateLimit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/auth/login" || r.Method != http.MethodPost {
			next.ServeHTTP(w, r)
			return
		}

		ip := realIP(r)
		now := time.Now()

		rateLimitMu.Lock()
		// periodic cleanup every 5 minutes
		if now.Sub(lastCleanup) > 5*time.Minute {
			for k, e := range rateLimitBuckets {
				if now.After(e.windowEnd) {
					delete(rateLimitBuckets, k)
				}
			}
			lastCleanup = now
		}

		entry, ok := rateLimitBuckets[ip]
		if !ok || now.After(entry.windowEnd) {
			rateLimitBuckets[ip] = &rateLimitEntry{count: 1, windowEnd: now.Add(time.Minute)}
			rateLimitMu.Unlock()
			next.ServeHTTP(w, r)
			return
		}
		entry.count++
		if entry.count > 5 {
			retryAfter := int(entry.windowEnd.Sub(now).Seconds()) + 1
			rateLimitMu.Unlock()
			w.Header().Set("Retry-After", strings.TrimRight(
				strings.TrimRight(
					strings.TrimRight(
						// format int without importing fmt
						func() string {
							n := retryAfter
							if n <= 0 {
								return "1"
							}
							buf := make([]byte, 0, 10)
							for n > 0 {
								buf = append([]byte{byte('0' + n%10)}, buf...)
								n /= 10
							}
							return string(buf)
						}(), "0"), "."), ","))
			http.Error(w, `{"error":"too many requests"}`, http.StatusTooManyRequests)
			return
		}
		rateLimitMu.Unlock()
		next.ServeHTTP(w, r)
	})
}

// ─── Helpers ───────────────────────────────────────────────────────────────

func extractToken(r *http.Request) string {
	// Authorization: Bearer <token>
	if h := r.Header.Get("Authorization"); strings.HasPrefix(h, "Bearer ") {
		return h[7:]
	}
	// SignalR negotiation: ?access_token=<token>
	return r.URL.Query().Get("access_token")
}

func realIP(r *http.Request) string {
	if ip := r.Header.Get("X-Forwarded-For"); ip != "" {
		return strings.SplitN(ip, ",", 2)[0]
	}
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	// strip port
	addr := r.RemoteAddr
	if i := strings.LastIndex(addr, ":"); i > 0 {
		return addr[:i]
	}
	return addr
}
