package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"

	"github.com/innovatek/minicluster/internal/models"
	"gorm.io/gorm"
)

// AgentAPIKey validates the X-Agent-Api-Key header on /api/cluster/* routes.
// It hashes the provided key and looks up the matching Machine record.
// Status/nodes read endpoints are exempted.
func AgentAPIKey(db *gorm.DB) func(http.Handler) http.Handler {
	exempt := func(path, method string) bool {
		// Allow GET /api/cluster/status and /api/cluster/nodes without API key
		if method == http.MethodGet &&
			(strings.HasPrefix(path, "/api/cluster/status") ||
				strings.HasPrefix(path, "/api/cluster/nodes")) {
			return true
		}
		return false
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !strings.HasPrefix(r.URL.Path, "/api/cluster") {
				next.ServeHTTP(w, r)
				return
			}
			if exempt(r.URL.Path, r.Method) {
				next.ServeHTTP(w, r)
				return
			}

			// JWT-authenticated users bypass agent key check
			if GetClaims(r) != nil {
				next.ServeHTTP(w, r)
				return
			}

			key := r.Header.Get("X-Agent-Api-Key")
			if key == "" {
				http.Error(w, `{"error":"agent api key required"}`, http.StatusUnauthorized)
				return
			}

			hashed := hashAPIKey(key)
			var machine models.Machine
			if err := db.Where("agent_api_key = ?", hashed).First(&machine).Error; err != nil {
				http.Error(w, `{"error":"invalid agent api key"}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), MachineKey, &machine)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// HashAPIKey hashes an API key with SHA-256 for storage/comparison.
func HashAPIKey(key string) string {
	return hashAPIKey(key)
}

func hashAPIKey(key string) string {
	h := sha256.Sum256([]byte(key))
	return hex.EncodeToString(h[:])
}
