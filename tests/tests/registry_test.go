package tests

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ─── DTOs ─────────────────────────────────────────────────────────────────

type RegistryPackage struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Version     string    `json:"version"`
	Description string    `json:"description"`
	Author      string    `json:"author"`
	Tags        string    `json:"tags"`
	FileSize    int64     `json:"fileSize"`
	Checksum    string    `json:"checksum"`
	Downloads   int       `json:"downloads"`
	CreatedAt   time.Time `json:"createdAt"`
}

type PackageInstall struct {
	ID          string     `json:"id"`
	PackageName string     `json:"packageName"`
	Version     string     `json:"version"`
	ServiceID   string     `json:"serviceId"`
	Components  string     `json:"components"`
	Status      string     `json:"status"`
	InstalledAt *time.Time `json:"installedAt"`
}

// ─── Registry package CRUD ────────────────────────────────────────────────

func TestRegistryPublishAndList(t *testing.T) {
	ctx := context.Background()

	pkgID := publishTestPackage(t, ctx, "test-pkg-list", "1.0.0", nil)
	t.Cleanup(func() {
		_ = apiClient.Delete(ctx, "/api/registry/packages/test-pkg-list/1.0.0")
	})
	require.NotEmpty(t, pkgID)

	// List
	var pkgs []RegistryPackage
	err := apiClient.Get(ctx, "/api/registry/packages?name=test-pkg-list", &pkgs)
	require.NoError(t, err)
	require.Len(t, pkgs, 1)
	assert.Equal(t, "test-pkg-list", pkgs[0].Name)
	assert.Equal(t, "1.0.0", pkgs[0].Version)
}

func TestRegistryGetPackage(t *testing.T) {
	ctx := context.Background()

	publishTestPackage(t, ctx, "test-pkg-get", "2.0.0", nil)
	t.Cleanup(func() {
		_ = apiClient.Delete(ctx, "/api/registry/packages/test-pkg-get/2.0.0")
	})

	var pkg RegistryPackage
	err := apiClient.Get(ctx, "/api/registry/packages/test-pkg-get/2.0.0", &pkg)
	require.NoError(t, err)
	assert.Equal(t, "test-pkg-get", pkg.Name)
	assert.Equal(t, "2.0.0", pkg.Version)
	assert.NotEmpty(t, pkg.Checksum)
}

func TestRegistryListVersions(t *testing.T) {
	ctx := context.Background()

	for _, ver := range []string{"1.0.0", "1.1.0", "2.0.0"} {
		publishTestPackage(t, ctx, "test-pkg-versions", ver, []byte("fake"))
	}
	t.Cleanup(func() {
		for _, ver := range []string{"1.0.0", "1.1.0", "2.0.0"} {
			_ = apiClient.Delete(ctx, "/api/registry/packages/test-pkg-versions/"+ver)
		}
	})

	var pkgs []RegistryPackage
	err := apiClient.Get(ctx, "/api/registry/packages/test-pkg-versions", &pkgs)
	require.NoError(t, err)
	assert.Len(t, pkgs, 3)
}

func TestRegistryUnpublish(t *testing.T) {
	ctx := context.Background()

	publishTestPackage(t, ctx, "test-pkg-delete", "1.0.0", []byte("fake"))

	err := apiClient.Delete(ctx, "/api/registry/packages/test-pkg-delete/1.0.0")
	require.NoError(t, err)

	// Should 404 now
	err = apiClient.Get(ctx, "/api/registry/packages/test-pkg-delete/1.0.0", nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "404")
}

func TestRegistryDuplicateConflict(t *testing.T) {
	ctx := context.Background()

	publishTestPackage(t, ctx, "test-pkg-dup", "1.0.0", []byte("fake"))
	t.Cleanup(func() {
		_ = apiClient.Delete(ctx, "/api/registry/packages/test-pkg-dup/1.0.0")
	})

	// Second publish should 409
	err := publishTestPackageErr(ctx, "test-pkg-dup", "1.0.0", []byte("fake"))
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "409")
}

// ─── Install / uninstall ──────────────────────────────────────────────────

func TestRegistryInstall(t *testing.T) {
	ctx := context.Background()

	publishTestPackage(t, ctx, "test-pkg-install", "1.0.0", nil)
	t.Cleanup(func() {
		_ = apiClient.Delete(ctx, "/api/registry/packages/test-pkg-install/1.0.0")
	})

	body := map[string]string{"name": "test-pkg-install", "version": "1.0.0"}
	var install PackageInstall
	err := apiClient.Post(ctx, "/api/registry/install", body, &install)
	require.NoError(t, err)
	assert.Equal(t, "installed", install.Status)
	assert.Equal(t, "test-pkg-install", install.PackageName)
	assert.NotEmpty(t, install.ServiceID)

	t.Cleanup(func() {
		if install.ServiceID != "" {
			_ = apiClient.Delete(ctx, "/api/services/"+install.ServiceID)
		}
		_ = apiClient.Delete(ctx, "/api/registry/installs/"+install.ID)
	})

	// List installs
	var installs []PackageInstall
	err = apiClient.Get(ctx, "/api/registry/installs", &installs)
	require.NoError(t, err)
	found := false
	for _, inst := range installs {
		if inst.ID == install.ID {
			found = true
			break
		}
	}
	assert.True(t, found)
}

func TestRegistryInstallLatest(t *testing.T) {
	ctx := context.Background()

	publishTestPackage(t, ctx, "test-pkg-latest", "3.0.0", nil)
	t.Cleanup(func() {
		_ = apiClient.Delete(ctx, "/api/registry/packages/test-pkg-latest/3.0.0")
	})

	// Install without specifying version — should pick latest
	body := map[string]string{"name": "test-pkg-latest"}
	var install PackageInstall
	err := apiClient.Post(ctx, "/api/registry/install", body, &install)
	require.NoError(t, err)
	assert.Equal(t, "3.0.0", install.Version)

	t.Cleanup(func() {
		if install.ServiceID != "" {
			_ = apiClient.Delete(ctx, "/api/services/"+install.ServiceID)
		}
		_ = apiClient.Delete(ctx, "/api/registry/installs/"+install.ID)
	})
}

// ─── CLI registry commands ────────────────────────────────────────────────

func TestCLIRegistryList(t *testing.T) {
	ctx := context.Background()

	publishTestPackage(t, ctx, "test-cli-reg-list", "1.0.0", []byte("fake"))
	t.Cleanup(func() {
		_ = apiClient.Delete(ctx, "/api/registry/packages/test-cli-reg-list/1.0.0")
	})

	result := testEnv.RunCLI("registry", "list")
	assert.Equal(t, 0, result.ExitCode, result.Stderr)
	assert.Contains(t, result.Stdout, "test-cli-reg-list")
}

func TestCLIRegistryVersions(t *testing.T) {
	ctx := context.Background()

	publishTestPackage(t, ctx, "test-cli-versions", "1.0.0", []byte("fake"))
	publishTestPackage(t, ctx, "test-cli-versions", "2.0.0", []byte("fake2"))
	t.Cleanup(func() {
		_ = apiClient.Delete(ctx, "/api/registry/packages/test-cli-versions/1.0.0")
		_ = apiClient.Delete(ctx, "/api/registry/packages/test-cli-versions/2.0.0")
	})

	result := testEnv.RunCLI("registry", "versions", "test-cli-versions")
	assert.Equal(t, 0, result.ExitCode, result.Stderr)
	assert.Contains(t, result.Stdout, "1.0.0")
	assert.Contains(t, result.Stdout, "2.0.0")
}

func TestCLIInstall(t *testing.T) {
	ctx := context.Background()

	publishTestPackage(t, ctx, "test-cli-install", "1.0.0", []byte("fake"))
	t.Cleanup(func() {
		_ = apiClient.Delete(ctx, "/api/registry/packages/test-cli-install/1.0.0")
	})

	result := testEnv.RunCLI("install", "test-cli-install@1.0.0")
	assert.Equal(t, 0, result.ExitCode, result.Stderr)
	assert.Contains(t, result.Stdout, "Installed")
}

// ─── helpers ─────────────────────────────────────────────────────────────

// publishTestPackage builds a valid .mcpkg ZIP and uploads it to the registry.
// The content parameter is ignored — a valid ZIP is always generated from name+version.
func publishTestPackage(t *testing.T, ctx context.Context, name, version string, _ []byte) string {
	t.Helper()
	zipData := makeTestMCPKG(name, version)
	body := &bytes.Buffer{}
	w := multipart.NewWriter(body)
	part, _ := w.CreateFormFile("package", name+"@"+version+".mcpkg")
	part.Write(zipData)
	w.WriteField("name", name)
	w.WriteField("version", version)
	w.WriteField("description", "test package "+name)
	w.WriteField("author", "test")
	w.Close()

	url := testEnv.APIServerURL + "/api/registry/packages"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, body)
	require.NoError(t, err)
	req.Header.Set("Content-Type", w.FormDataContentType())
	if testEnv.AuthToken != "" {
		req.Header.Set("Authorization", "Bearer "+testEnv.AuthToken)
	}

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		body2, _ := io.ReadAll(resp.Body)
		t.Fatalf("publish failed: status %d: %s", resp.StatusCode, string(body2))
	}

	var pkg RegistryPackage
	err = decodeJSON(resp.Body, &pkg)
	require.NoError(t, err)
	return pkg.ID
}

// makeTestMCPKG creates a minimal valid .mcpkg ZIP for the given name+version.
func makeTestMCPKG(name, version string) []byte {
	mf := map[string]interface{}{
		"name":    name,
		"version": version,
		"runtime": map[string]string{
			"type":    "process",
			"command": "echo",
		},
	}
	mfJSON, _ := json.Marshal(mf)
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	w, _ := zw.Create("manifest.json")
	w.Write(mfJSON)
	zw.Close()
	return buf.Bytes()
}

// publishTestPackageErr publishes a package and returns any error (used to test conflict)
func publishTestPackageErr(ctx context.Context, name, version string, _ []byte) error {
	zipData := makeTestMCPKG(name, version)
	body := &bytes.Buffer{}
	w := multipart.NewWriter(body)
	part, _ := w.CreateFormFile("package", name+".mcpkg")
	part.Write(zipData)
	w.WriteField("name", name)
	w.WriteField("version", version)
	w.Close()

	url := testEnv.APIServerURL + "/api/registry/packages"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, body)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", w.FormDataContentType())
	if testEnv.AuthToken != "" {
		req.Header.Set("Authorization", "Bearer "+testEnv.AuthToken)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	return nil
}

// decodeJSON decodes a JSON reader into v
func decodeJSON(r io.Reader, v interface{}) error {
	return json.NewDecoder(r).Decode(v)
}

// ─── V2 multi-component manifest tests ───────────────────────────────────

// makeV2TestMCPKG creates a minimal v2 .mcpkg with two components (container + process).
func makeV2TestMCPKG(name, version string) []byte {
	mf := map[string]interface{}{
		"schemaVersion": "2.0",
		"name":          name,
		"version":       version,
		"description":   "test v2 package",
		"components": []map[string]interface{}{
			{
				"name":  "db",
				"type":  "container",
				"image": "redis:7-alpine",
				"ports": []map[string]interface{}{{"host": 6399, "container": 6379}},
			},
			{
				"name":    "api",
				"type":    "process",
				"command": "echo",
				"arguments": "hello",
				"dependsOn": []map[string]interface{}{
					{"component": "db", "condition": "running"},
				},
			},
		},
	}
	mfJSON, _ := json.Marshal(mf)
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	w, _ := zw.Create("manifest.json")
	w.Write(mfJSON)
	zw.Close()
	return buf.Bytes()
}

func TestRegistryValidateV1Manifest(t *testing.T) {
	ctx := context.Background()

	mf := map[string]interface{}{
		"name":    "validate-test",
		"version": "1.0.0",
		"runtime": map[string]string{"type": "process", "command": "echo"},
	}
	var result map[string]interface{}
	err := apiClient.Post(ctx, "/api/registry/validate", mf, &result)
	require.NoError(t, err)
	assert.Equal(t, true, result["valid"])
	assert.Equal(t, "validate-test", result["name"])
}

func TestRegistryValidateV2Manifest(t *testing.T) {
	ctx := context.Background()

	mf := map[string]interface{}{
		"schemaVersion": "2.0",
		"name":          "validate-v2-test",
		"version":       "1.0.0",
		"components": []map[string]interface{}{
			{"name": "svc", "type": "container", "image": "alpine:latest"},
		},
	}
	var result map[string]interface{}
	err := apiClient.Post(ctx, "/api/registry/validate", mf, &result)
	require.NoError(t, err)
	assert.Equal(t, true, result["valid"])
	assert.Equal(t, float64(1), result["components"])
}

func TestRegistryValidateInvalidManifest(t *testing.T) {
	ctx := context.Background()

	// Container component missing image — should return 422
	mf := map[string]interface{}{
		"schemaVersion": "2.0",
		"name":          "bad-pkg",
		"version":       "1.0.0",
		"components": []map[string]interface{}{
			{"name": "svc", "type": "container"}, // no image
		},
	}
	var result map[string]interface{}
	err := apiClient.Post(ctx, "/api/registry/validate", mf, &result)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "422")
}

func TestRegistryGetManifest(t *testing.T) {
	ctx := context.Background()

	publishTestPackage(t, ctx, "test-manifest-ep", "1.0.0", nil)
	t.Cleanup(func() {
		_ = apiClient.Delete(ctx, "/api/registry/packages/test-manifest-ep/1.0.0")
	})

	var mf map[string]interface{}
	err := apiClient.Get(ctx, "/api/registry/packages/test-manifest-ep/1.0.0/manifest", &mf)
	require.NoError(t, err)
	assert.Equal(t, "test-manifest-ep", mf["name"])
}

func TestRegistryGetComponentsV1(t *testing.T) {
	ctx := context.Background()

	publishTestPackage(t, ctx, "test-comp-v1", "1.0.0", nil)
	t.Cleanup(func() {
		_ = apiClient.Delete(ctx, "/api/registry/packages/test-comp-v1/1.0.0")
	})

	type ComponentSummary struct {
		Name    string `json:"name"`
		Type    string `json:"type"`
		Command string `json:"command,omitempty"`
	}
	var comps []ComponentSummary
	err := apiClient.Get(ctx, "/api/registry/packages/test-comp-v1/1.0.0/components", &comps)
	require.NoError(t, err)
	require.Len(t, comps, 1)
	assert.Equal(t, "main", comps[0].Name)
	assert.Equal(t, "process", comps[0].Type)
}

func TestRegistryGetComponentsV2(t *testing.T) {
	ctx := context.Background()

	// Publish a v2 package
	zipData := makeV2TestMCPKG("test-comp-v2", "1.0.0")
	body := &bytes.Buffer{}
	mw := multipart.NewWriter(body)
	part, _ := mw.CreateFormFile("package", "test-comp-v2.mcpkg")
	part.Write(zipData)
	mw.WriteField("name", "test-comp-v2")
	mw.WriteField("version", "1.0.0")
	mw.Close()

	url := testEnv.APIServerURL + "/api/registry/packages"
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, url, body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	if testEnv.AuthToken != "" {
		req.Header.Set("Authorization", "Bearer "+testEnv.AuthToken)
	}
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	t.Cleanup(func() {
		_ = apiClient.Delete(ctx, "/api/registry/packages/test-comp-v2/1.0.0")
	})

	type ComponentSummary struct {
		Name      string   `json:"name"`
		Type      string   `json:"type"`
		DependsOn []string `json:"dependsOn,omitempty"`
	}
	var comps []ComponentSummary
	err = apiClient.Get(ctx, "/api/registry/packages/test-comp-v2/1.0.0/components", &comps)
	require.NoError(t, err)
	require.Len(t, comps, 2)

	names := map[string]bool{}
	for _, c := range comps {
		names[c.Name] = true
	}
	assert.True(t, names["db"])
	assert.True(t, names["api"])
}

func TestRegistryInstallV2Package(t *testing.T) {
	ctx := context.Background()

	// Publish v2 package
	zipData := makeV2TestMCPKG("test-install-v2", "1.0.0")
	body := &bytes.Buffer{}
	mw := multipart.NewWriter(body)
	part, _ := mw.CreateFormFile("package", "test-install-v2.mcpkg")
	part.Write(zipData)
	mw.WriteField("name", "test-install-v2")
	mw.WriteField("version", "1.0.0")
	mw.Close()

	url := testEnv.APIServerURL + "/api/registry/packages"
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, url, body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	if testEnv.AuthToken != "" {
		req.Header.Set("Authorization", "Bearer "+testEnv.AuthToken)
	}
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	resp.Body.Close()
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	t.Cleanup(func() {
		_ = apiClient.Delete(ctx, "/api/registry/packages/test-install-v2/1.0.0")
	})

	// Install — v2 creates multiple services
	var install PackageInstall
	err = apiClient.Post(ctx, "/api/registry/install", map[string]interface{}{
		"name":      "test-install-v2",
		"version":   "1.0.0",
		"autoStart": false,
	}, &install)
	require.NoError(t, err)
	assert.Equal(t, "installed", install.Status)
	// v2 install — ServiceID empty, Components should have entries
	assert.Empty(t, install.ServiceID, "v2 installs should not set serviceId")

	t.Cleanup(func() {
		_ = apiClient.Delete(ctx, "/api/registry/installs/"+install.ID)
	})
}
