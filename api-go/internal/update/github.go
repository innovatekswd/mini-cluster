package update

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"runtime"
	"strings"
	"time"

	"github.com/Masterminds/semver/v3"
)

// GitHubChecker queries the GitHub Releases API for the latest release.
// It is isolated so it can be swapped for a different source later.
type GitHubChecker struct {
	owner  string
	repo   string
	client *http.Client
}

// NewGitHubChecker creates a checker for the given GitHub owner/repo.
func NewGitHubChecker(owner, repo string) *GitHubChecker {
	return &GitHubChecker{
		owner: owner,
		repo:  repo,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// ghRelease mirrors the GitHub API response for a release.
type ghRelease struct {
	TagName     string    `json:"tag_name"`
	Name        string    `json:"name"`
	Body        string    `json:"body"`
	HTMLURL     string    `json:"html_url"`
	PublishedAt time.Time `json:"published_at"`
	Prerelease  bool      `json:"prerelease"`
	Draft       bool      `json:"draft"`
	Assets      []struct {
		Name               string `json:"name"`
		BrowserDownloadURL string `json:"browser_download_url"`
	} `json:"assets"`
}

// Latest fetches the latest non-prerelease, non-draft release from GitHub.
// It picks the asset matching the current GOOS/GOARCH.
func (g *GitHubChecker) Latest(ctx context.Context) (*ReleaseInfo, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/releases/latest", g.owner, g.repo)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := g.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch release: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("github api returned status %d", resp.StatusCode)
	}

	var rel ghRelease
	if err := json.NewDecoder(resp.Body).Decode(&rel); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	// Validate tag is valid semver
	tag := strings.TrimPrefix(rel.TagName, "v")
	if _, err := semver.NewVersion(tag); err != nil {
		return nil, fmt.Errorf("invalid semver tag %q: %w", rel.TagName, err)
	}

	// Find asset matching current platform
	assetURL, assetName := g.findMatchingAsset(rel.Assets)

	return &ReleaseInfo{
		Version:      rel.TagName,
		ReleaseURL:   rel.HTMLURL,
		ReleaseNotes: rel.Body,
		PublishedAt:  rel.PublishedAt,
		AssetURL:     assetURL,
		AssetName:    assetName,
	}, nil
}

// findMatchingAsset picks the asset for the current GOOS/GOARCH.
// Returns empty strings if no match is found.
func (g *GitHubChecker) findMatchingAsset(assets []struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
}) (string, string) {
	goos := runtime.GOOS
	goarch := runtime.GOARCH

	// Common patterns: minicluster_linux_amd64, minicluster-linux-amd64, etc.
	patterns := []string{
		fmt.Sprintf("%s_%s", goos, goarch),
		fmt.Sprintf("%s-%s", goos, goarch),
	}

	for _, asset := range assets {
		name := strings.ToLower(asset.Name)
		for _, pattern := range patterns {
			if strings.Contains(name, pattern) {
				return asset.BrowserDownloadURL, asset.Name
			}
		}
	}
	return "", ""
}
