package tests

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// randomString generates a random string of given length
func randomString(length int) string {
	bytes := make([]byte, length/2)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)[:length]
}

func TestFileUpload(t *testing.T) {
	ctx := context.Background()

	// Create a temp file to upload
	tmpFile := filepath.Join(os.TempDir(), "test-upload-"+randomString(8)+".txt")
	defer os.Remove(tmpFile)

	content := "Test file content for upload test"
	err := os.WriteFile(tmpFile, []byte(content), 0644)
	require.NoError(t, err, "Failed to create temp file")

	// Upload the file
	result := testEnv.RunCLI("file", "upload", tmpFile, "test-folder")
	require.Equal(t, 0, result.ExitCode, "File upload should succeed: %s", result.Stderr)
	assert.Contains(t, result.Stdout, "uploaded successfully", "Upload message not found")

	// Cleanup (optional - the folder will be removed when server restarts)
	_ = ctx
}

func TestFileDownload(t *testing.T) {
	ctx := context.Background()

	// First, upload a file
	tmpUploadFile := filepath.Join(os.TempDir(), "test-download-src-"+randomString(8)+".txt")
	defer os.Remove(tmpUploadFile)

	content := "Test file content for download test"
	err := os.WriteFile(tmpUploadFile, []byte(content), 0644)
	require.NoError(t, err, "Failed to create temp upload file")

	folderName := "download-test-" + randomString(8)
	result := testEnv.RunCLI("file", "upload", tmpUploadFile, folderName)
	require.Equal(t, 0, result.ExitCode, "Failed to upload file for download test: %s", result.Stderr)

	// Now download it
	tmpDownloadFile := filepath.Join(os.TempDir(), "test-download-dst-"+randomString(8)+".txt")
	defer os.Remove(tmpDownloadFile)

	fileName := filepath.Base(tmpUploadFile)
	sourcePath := folderName + "/" + fileName

	result = testEnv.RunCLI("file", "download", sourcePath, tmpDownloadFile)
	require.Equal(t, 0, result.ExitCode, "File download should succeed: %s", result.Stderr)
	assert.Contains(t, result.Stdout, "downloaded successfully", "Download message not found")

	// Verify content
	downloadedContent, err := os.ReadFile(tmpDownloadFile)
	require.NoError(t, err, "Failed to read downloaded file")
	assert.Equal(t, content, string(downloadedContent), "Downloaded content doesn't match")

	_ = ctx
}

func TestFileUploadToNestedFolder(t *testing.T) {
	ctx := context.Background()

	// Create a temp file to upload
	tmpFile := filepath.Join(os.TempDir(), "test-nested-"+randomString(8)+".txt")
	defer os.Remove(tmpFile)

	content := "Test file for nested folder upload"
	err := os.WriteFile(tmpFile, []byte(content), 0644)
	require.NoError(t, err, "Failed to create temp file")

	// Upload to nested folder
	folderPath := "level1/level2/level3"
	result := testEnv.RunCLI("file", "upload", tmpFile, folderPath)
	require.Equal(t, 0, result.ExitCode, "Nested folder upload should succeed: %s", result.Stderr)
	assert.Contains(t, result.Stdout, "uploaded successfully", "Upload message not found")

	// Download it back to verify
	tmpDownloadFile := filepath.Join(os.TempDir(), "test-nested-download-"+randomString(8)+".txt")
	defer os.Remove(tmpDownloadFile)

	fileName := filepath.Base(tmpFile)
	sourcePath := folderPath + "/" + fileName

	result = testEnv.RunCLI("file", "download", sourcePath, tmpDownloadFile)
	require.Equal(t, 0, result.ExitCode, "Failed to download from nested folder: %s", result.Stderr)

	// Verify content
	downloadedContent, err := os.ReadFile(tmpDownloadFile)
	require.NoError(t, err, "Failed to read downloaded file")
	assert.Equal(t, content, string(downloadedContent), "Downloaded content doesn't match")

	_ = ctx
}

func TestFileUploadNonExistent(t *testing.T) {
	// Try to upload a non-existent file
	nonExistentFile := "/tmp/this-file-does-not-exist-" + randomString(16) + ".txt"
	result := testEnv.RunCLI("file", "upload", nonExistentFile, "test-folder")
	require.NotEqual(t, 0, result.ExitCode, "Should fail when uploading non-existent file")
	assert.Contains(t, result.Stderr, "does not exist", "Should have error message about non-existent file")
}

func TestFileDownloadNonExistent(t *testing.T) {
	// Try to download a non-existent file
	tmpDownloadFile := filepath.Join(os.TempDir(), "should-not-be-created-"+randomString(8)+".txt")
	defer os.Remove(tmpDownloadFile) // Just in case

	sourcePath := "nonexistent-folder/nonexistent-file.txt"
	result := testEnv.RunCLI("file", "download", sourcePath, tmpDownloadFile)
	require.NotEqual(t, 0, result.ExitCode, "Should fail when downloading non-existent file")

	// Verify file was not created
	_, statErr := os.Stat(tmpDownloadFile)
	assert.True(t, os.IsNotExist(statErr), "Download file should not exist")
}

func TestFileDownloadToDirectory(t *testing.T) {
	ctx := context.Background()

	// Upload a file first
	tmpUploadFile := filepath.Join(os.TempDir(), "test-dir-download-"+randomString(8)+".txt")
	defer os.Remove(tmpUploadFile)

	content := "Test file for directory download"
	err := os.WriteFile(tmpUploadFile, []byte(content), 0644)
	require.NoError(t, err, "Failed to create temp upload file")

	folderName := "dir-test-" + randomString(8)
	result := testEnv.RunCLI("file", "upload", tmpUploadFile, folderName)
	require.Equal(t, 0, result.ExitCode, "Failed to upload file: %s", result.Stderr)

	// Download to a directory
	tmpDownloadDir := filepath.Join(os.TempDir(), "test-download-dir-"+randomString(8))
	err = os.MkdirAll(tmpDownloadDir, 0755)
	require.NoError(t, err, "Failed to create download directory")
	defer os.RemoveAll(tmpDownloadDir)

	fileName := filepath.Base(tmpUploadFile)
	sourcePath := folderName + "/" + fileName

	result = testEnv.RunCLI("file", "download", sourcePath, tmpDownloadDir)
	require.Equal(t, 0, result.ExitCode, "Failed to download to directory: %s", result.Stderr)

	// Verify file exists in directory with correct name
	downloadedFilePath := filepath.Join(tmpDownloadDir, fileName)
	downloadedContent, err := os.ReadFile(downloadedFilePath)
	require.NoError(t, err, "Failed to read downloaded file in directory")
	assert.Equal(t, content, string(downloadedContent), "Downloaded content doesn't match")

	_ = ctx
}

func TestFileUploadWithSpacesInName(t *testing.T) {
	ctx := context.Background()

	// Create a file with spaces in the name
	tmpFile := filepath.Join(os.TempDir(), "test file with spaces "+randomString(8)+".txt")
	defer os.Remove(tmpFile)

	content := "Test file with spaces in name"
	err := os.WriteFile(tmpFile, []byte(content), 0644)
	require.NoError(t, err, "Failed to create temp file")

	// Upload the file
	folderName := "spaces-test-" + randomString(8)
	result := testEnv.RunCLI("file", "upload", tmpFile, folderName)
	require.Equal(t, 0, result.ExitCode, "Failed to upload file with spaces: %s", result.Stderr)
	assert.Contains(t, result.Stdout, "uploaded successfully", "Upload message not found")

	// Download it back
	tmpDownloadFile := filepath.Join(os.TempDir(), "test-spaces-download-"+randomString(8)+".txt")
	defer os.Remove(tmpDownloadFile)

	fileName := filepath.Base(tmpFile)
	sourcePath := folderName + "/" + fileName

	result = testEnv.RunCLI("file", "download", sourcePath, tmpDownloadFile)
	require.Equal(t, 0, result.ExitCode, "Failed to download file with spaces: %s", result.Stderr)

	// Verify content
	downloadedContent, err := os.ReadFile(tmpDownloadFile)
	require.NoError(t, err, "Failed to read downloaded file")
	assert.Equal(t, content, string(downloadedContent), "Downloaded content doesn't match")

	_ = ctx
}

func TestFolderDownload(t *testing.T) {
	ctx := context.Background()

	// Create multiple files to upload
	folderName := "folder-download-test-" + randomString(8)

	// Upload file 1
	tmpFile1 := filepath.Join(os.TempDir(), "folder-test-1.txt")
	defer os.Remove(tmpFile1)
	content1 := "Content of file 1"
	err := os.WriteFile(tmpFile1, []byte(content1), 0644)
	require.NoError(t, err, "Failed to create temp file")

	result := testEnv.RunCLI("file", "upload", tmpFile1, folderName)
	require.Equal(t, 0, result.ExitCode, "Failed to upload file 1: %s", result.Stderr)

	// Upload file 2
	tmpFile2 := filepath.Join(os.TempDir(), "folder-test-2.txt")
	defer os.Remove(tmpFile2)
	content2 := "Content of file 2"
	err = os.WriteFile(tmpFile2, []byte(content2), 0644)
	require.NoError(t, err, "Failed to create temp file")

	result = testEnv.RunCLI("file", "upload", tmpFile2, folderName)
	require.Equal(t, 0, result.ExitCode, "Failed to upload file 2: %s", result.Stderr)

	// Upload file 3 to subdirectory
	tmpFile3 := filepath.Join(os.TempDir(), "folder-test-3.txt")
	defer os.Remove(tmpFile3)
	content3 := "Content of file 3 in subdir"
	err = os.WriteFile(tmpFile3, []byte(content3), 0644)
	require.NoError(t, err, "Failed to create temp file")

	result = testEnv.RunCLI("file", "upload", tmpFile3, folderName+"/subdir")
	require.Equal(t, 0, result.ExitCode, "Failed to upload file 3: %s", result.Stderr)

	// Now download the entire folder
	tmpDownloadDir := filepath.Join(os.TempDir(), "folder-download-"+randomString(8))
	defer os.RemoveAll(tmpDownloadDir)

	result = testEnv.RunCLI("file", "download", folderName, tmpDownloadDir)
	require.Equal(t, 0, result.ExitCode, "Failed to download folder: %s", result.Stderr)
	assert.Contains(t, result.Stdout, "extracted successfully", "Success message not found")

	// Verify all files were extracted
	downloadedFile1 := filepath.Join(tmpDownloadDir, folderName, "folder-test-1.txt")
	content, err := os.ReadFile(downloadedFile1)
	require.NoError(t, err, "Failed to read downloaded file 1")
	assert.Equal(t, content1, string(content), "File 1 content doesn't match")

	downloadedFile2 := filepath.Join(tmpDownloadDir, folderName, "folder-test-2.txt")
	content, err = os.ReadFile(downloadedFile2)
	require.NoError(t, err, "Failed to read downloaded file 2")
	assert.Equal(t, content2, string(content), "File 2 content doesn't match")

	downloadedFile3 := filepath.Join(tmpDownloadDir, folderName, "subdir", "folder-test-3.txt")
	content, err = os.ReadFile(downloadedFile3)
	require.NoError(t, err, "Failed to read downloaded file 3")
	assert.Equal(t, content3, string(content), "File 3 content doesn't match")

	_ = ctx
}

func TestFileList(t *testing.T) {
	ctx := context.Background()

	// Create a unique folder for this test
	folderName := "list-test-" + randomString(8)

	// Upload some files
	file1 := filepath.Join(os.TempDir(), "list-file-1.txt")
	defer os.Remove(file1)
	err := os.WriteFile(file1, []byte("Content 1"), 0644)
	require.NoError(t, err, "Failed to create temp file 1")

	result := testEnv.RunCLI("file", "upload", file1, folderName)
	require.Equal(t, 0, result.ExitCode, "Failed to upload file 1: %s", result.Stderr)

	file2 := filepath.Join(os.TempDir(), "list-file-2.json")
	defer os.Remove(file2)
	err = os.WriteFile(file2, []byte(`{"test": true}`), 0644)
	require.NoError(t, err, "Failed to create temp file 2")

	result = testEnv.RunCLI("file", "upload", file2, folderName)
	require.Equal(t, 0, result.ExitCode, "Failed to upload file 2: %s", result.Stderr)

	// Create a subdirectory with a file
	file3 := filepath.Join(os.TempDir(), "list-file-3.csv")
	defer os.Remove(file3)
	err = os.WriteFile(file3, []byte("a,b,c\n1,2,3"), 0644)
	require.NoError(t, err, "Failed to create temp file 3")

	result = testEnv.RunCLI("file", "upload", file3, folderName+"/subdir")
	require.Equal(t, 0, result.ExitCode, "Failed to upload file 3: %s", result.Stderr)

	// Now list the folder
	result = testEnv.RunCLI("file", "list", folderName)
	require.Equal(t, 0, result.ExitCode, "File list should succeed: %s", result.Stderr)

	// Verify output contains file names
	assert.Contains(t, result.Stdout, "list-file-1.txt", "File 1 should be in list")
	assert.Contains(t, result.Stdout, "list-file-2.json", "File 2 should be in list")
	assert.Contains(t, result.Stdout, "subdir", "Subdirectory should be in list")
	assert.Contains(t, result.Stdout, "TYPE", "Should have table header")
	assert.Contains(t, result.Stdout, "Total:", "Should have total count")

	// List the subdirectory
	result = testEnv.RunCLI("file", "list", folderName+"/subdir")
	require.Equal(t, 0, result.ExitCode, "Subdir list should succeed: %s", result.Stderr)
	assert.Contains(t, result.Stdout, "list-file-3.csv", "File 3 should be in subdir list")

	// List root (no argument)
	result = testEnv.RunCLI("file", "list")
	require.Equal(t, 0, result.ExitCode, "Root list should succeed: %s", result.Stderr)
	assert.Contains(t, result.Stdout, folderName, "Test folder should be in root list")

	_ = ctx
}

func TestFileUploadBulk(t *testing.T) {
	ctx := context.Background()

	// Create multiple files with a pattern
	tmpDir := filepath.Join(os.TempDir(), "bulk-test-"+randomString(8))
	err := os.MkdirAll(tmpDir, 0755)
	require.NoError(t, err, "Failed to create temp directory")
	defer os.RemoveAll(tmpDir)

	// Create test files
	files := []string{"test1.json", "test2.json", "test3.json", "test4.txt"}
	for _, name := range files {
		filePath := filepath.Join(tmpDir, name)
		err := os.WriteFile(filePath, []byte("test content: "+name), 0644)
		require.NoError(t, err, "Failed to create test file: "+name)
	}

	// Use bulk upload with glob pattern for JSON files
	folderName := "bulk-upload-" + randomString(8)
	pattern := filepath.Join(tmpDir, "*.json")

	result := testEnv.RunCLI("file", "upload-bulk", pattern, folderName)
	require.Equal(t, 0, result.ExitCode, "Bulk upload should succeed: %s", result.Stderr)
	assert.Contains(t, result.Stdout, "uploaded successfully", "Should show success message")
	assert.Contains(t, result.Stdout, "3", "Should upload 3 JSON files")

	// Verify files were uploaded by listing
	result = testEnv.RunCLI("file", "list", folderName)
	require.Equal(t, 0, result.ExitCode, "List should succeed")
	assert.Contains(t, result.Stdout, "test1.json", "File 1 should be uploaded")
	assert.Contains(t, result.Stdout, "test2.json", "File 2 should be uploaded")
	assert.Contains(t, result.Stdout, "test3.json", "File 3 should be uploaded")
	assert.NotContains(t, result.Stdout, "test4.txt", "TXT file should not be uploaded")

	_ = ctx
}

func TestFileUploadBulkNoMatch(t *testing.T) {
	// Try bulk upload with pattern that matches nothing
	pattern := "/tmp/nonexistent-pattern-*.xyz"
	result := testEnv.RunCLI("file", "upload-bulk", pattern, "test-folder")
	require.NotEqual(t, 0, result.ExitCode, "Should fail when no files match pattern")
	assert.Contains(t, result.Stderr, "no files match", "Should have error about no matches")
}

func TestFileUploadWithNoProgress(t *testing.T) {
	ctx := context.Background()

	// Create a file to upload
	tmpFile := filepath.Join(os.TempDir(), "no-progress-test-"+randomString(8)+".txt")
	defer os.Remove(tmpFile)

	content := "Test file for no-progress flag"
	err := os.WriteFile(tmpFile, []byte(content), 0644)
	require.NoError(t, err, "Failed to create temp file")

	// Upload with --no-progress flag
	folderName := "no-progress-" + randomString(8)
	result := testEnv.RunCLI("file", "upload", "--no-progress", tmpFile, folderName)
	require.Equal(t, 0, result.ExitCode, "Upload with --no-progress should succeed: %s", result.Stderr)
	assert.Contains(t, result.Stdout, "uploaded successfully", "Should show success message")

	// Verify no progress bar was shown (progress bars use \r)
	assert.NotContains(t, result.Stdout, "\r", "Should not show progress bar with --no-progress")

	_ = ctx
}

func TestFileBulkUploadWithNoProgress(t *testing.T) {
	ctx := context.Background()

	// Create multiple files
	tmpDir := filepath.Join(os.TempDir(), "bulk-noprogress-"+randomString(8))
	err := os.MkdirAll(tmpDir, 0755)
	require.NoError(t, err, "Failed to create temp directory")
	defer os.RemoveAll(tmpDir)

	for i := 1; i <= 3; i++ {
		filePath := filepath.Join(tmpDir, "file"+string(rune('0'+i))+".dat")
		err := os.WriteFile(filePath, []byte("data"), 0644)
		require.NoError(t, err, "Failed to create test file")
	}

	// Bulk upload with --no-progress
	folderName := "bulk-noprogress-" + randomString(8)
	pattern := filepath.Join(tmpDir, "*.dat")

	result := testEnv.RunCLI("file", "upload-bulk", "--no-progress", pattern, folderName)
	require.Equal(t, 0, result.ExitCode, "Bulk upload with --no-progress should succeed: %s", result.Stderr)
	assert.Contains(t, result.Stdout, "uploaded successfully", "Should show success message")

	_ = ctx
}

func TestFileListEmptyFolder(t *testing.T) {
	// Try to list a non-existent folder
	result := testEnv.RunCLI("file", "list", "nonexistent-folder-"+randomString(16))
	// Should return error for non-existent folder
	require.Equal(t, 1, result.ExitCode, "List non-existent folder should return error")
	assert.Contains(t, result.Stderr, "Not Found", "Should indicate folder not found")
}
