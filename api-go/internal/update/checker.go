// Package update provides a swappable update-checking abstraction.
// The Checker interface can be backed by GitHub Releases, a private registry,
// or any other source — swap the implementation without touching callers.
package update

import (
	"context"
	"sync"
	"time"
)

// ReleaseInfo describes a single available release.
type ReleaseInfo struct {
	Version     string    `json:"version"`      // e.g. "v1.2.3"
	ReleaseURL  string    `json:"releaseUrl"`   // link to the release page
	ReleaseNotes string   `json:"releaseNotes"` // markdown body
	PublishedAt time.Time `json:"publishedAt"`
	AssetURL    string    `json:"assetUrl"`     // direct download link for the binary asset
	AssetName   string    `json:"assetName"`    // filename of the asset
}

// CheckResult is the response returned to the frontend.
type CheckResult struct {
	CurrentVersion string       `json:"currentVersion"`
	LatestVersion  string       `json:"latestVersion"`
	UpdateAvailable bool        `json:"updateAvailable"`
	Release        *ReleaseInfo `json:"release,omitempty"`
}

// Checker is the swappable interface for update sources.
type Checker interface {
	// Latest returns the newest available release.
	Latest(ctx context.Context) (*ReleaseInfo, error)
}

// CachedChecker wraps a Checker and caches results for a configurable TTL
// to avoid hammering upstream APIs (e.g. GitHub rate limits).
type CachedChecker struct {
	inner   Checker
	ttl     time.Duration
	mu      sync.Mutex
	cached  *ReleaseInfo
	fetchedAt time.Time
}

// NewCachedChecker wraps inner with a cache that expires after ttl.
func NewCachedChecker(inner Checker, ttl time.Duration) *CachedChecker {
	return &CachedChecker{inner: inner, ttl: ttl}
}

// Latest returns the cached release if still fresh, otherwise fetches a new one.
func (c *CachedChecker) Latest(ctx context.Context) (*ReleaseInfo, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.cached != nil && time.Since(c.fetchedAt) < c.ttl {
		return c.cached, nil
	}

	rel, err := c.inner.Latest(ctx)
	if err != nil {
		return nil, err
	}
	c.cached = rel
	c.fetchedAt = time.Now()
	return rel, nil
}
