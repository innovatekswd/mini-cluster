package cmd

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
)

var fileCmd = &cobra.Command{
	Use:     "file",
	Aliases: []string{"files"},
	Short:   "Manage files on the MiniCluster server",
	Long:    `Upload and download files to/from the MiniCluster server.`,
}

var fileUploadCmd = &cobra.Command{
	Use:   "upload <source> <destination>",
	Short: "Upload a file to the server",
	Long: `Upload a file from your local machine to the MiniCluster server.

The source is the local file path, and the destination is the target folder on the server.

Examples:
  mc file upload ./config.json prod
  mc file upload ~/data.csv backup/data
  mc file upload "./my app/config.yml" production`,
	Args: cobra.ExactArgs(2),
	RunE: runFileUpload,
}

var fileDownloadCmd = &cobra.Command{
	Use:   "download <source> <destination>",
	Short: "Download a file or folder from the server",
	Long: `Download a file or folder from the MiniCluster server to your local machine.

For files: folder/filename
For folders: folder (downloads entire folder as zip and extracts)

The destination is the local path where the file/folder will be saved.

Examples:
  # Download a single file
  mc file download prod/config.json ./config.json
  mc file download backup/data/data.csv ~/downloads/

  # Download an entire folder
  mc file download prod/configs ./local-configs
  mc file download backup/2026-01 ~/backups/january

  # Files with spaces
  mc file download "production/my config.yml" ./config.yml`,
	Args: cobra.ExactArgs(2),
	RunE: runFileDownload,
}

var fileListCmd = &cobra.Command{
	Use:   "list [folder]",
	Short: "List files and folders on the server",
	Long: `List files and directories in a folder on the MiniCluster server.

If no folder is specified, lists files in the root directory.

Examples:
  mc file list
  mc file list prod
  mc file list backup/2026-01
  mc file list "production/my configs"`,
	Args: cobra.MaximumNArgs(1),
	RunE: runFileList,
}

var fileUploadBulkCmd = &cobra.Command{
	Use:   "upload-bulk <pattern> <destination>",
	Short: "Upload multiple files to the server",
	Long: `Upload multiple files matching a pattern to the MiniCluster server.

Use glob patterns to select multiple files (*.json, *.csv, etc.).
All files are uploaded to the same destination folder.

Examples:
  # Upload all JSON files in current directory
  mc file upload-bulk *.json prod

  # Upload all CSV files from a specific folder
  mc file upload-bulk ./data/*.csv backup/data

  # Upload specific files
  mc file upload-bulk "./configs/*.{json,yml}" production`,
	Args: cobra.ExactArgs(2),
	RunE: runFileUploadBulk,
}

var (
	uploadNoProgress   bool
	downloadNoProgress bool
)

func init() {
	rootCmd.AddCommand(fileCmd)
	fileCmd.AddCommand(fileUploadCmd)
	fileCmd.AddCommand(fileDownloadCmd)
	fileCmd.AddCommand(fileListCmd)
	fileCmd.AddCommand(fileUploadBulkCmd)

	// Add flags for progress bars
	fileUploadCmd.Flags().BoolVar(&uploadNoProgress, "no-progress", false, "Disable progress bar")
	fileUploadBulkCmd.Flags().BoolVar(&uploadNoProgress, "no-progress", false, "Disable progress bar")
	fileDownloadCmd.Flags().BoolVar(&downloadNoProgress, "no-progress", false, "Disable progress bar")
}

func runFileUpload(cmd *cobra.Command, args []string) error {
	ctx := context.Background()
	client := GetClient()
	out := GetFormatter()

	sourcePath := args[0]
	targetFolder := args[1]

	// Check if source file exists
	fileInfo, err := os.Stat(sourcePath)
	if err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("source file does not exist: %s", sourcePath)
		}
		return fmt.Errorf("failed to access source file: %w", err)
	}

	if fileInfo.IsDir() {
		return fmt.Errorf("source is a directory, not a file. Use a file path instead")
	}

	// Open the file
	file, err := os.Open(sourcePath)
	if err != nil {
		return fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	// Get filename from path
	fileName := filepath.Base(sourcePath)

	out.Info(fmt.Sprintf("Uploading %s to %s/%s...", fileName, targetFolder, fileName))

	// Upload with or without progress
	var result map[string]interface{}
	if uploadNoProgress {
		result, err = client.UploadFile(ctx, file, fileName, targetFolder)
		if err != nil {
			return fmt.Errorf("failed to upload file: %w", err)
		}
	} else {
		// Show progress bar
		var lastPercent int
		progress := func(current, total int64) {
			if total == 0 {
				return
			}
			percent := int((float64(current) / float64(total)) * 100)
			if percent > lastPercent {
				lastPercent = percent
				bar := strings.Repeat("█", percent/5) + strings.Repeat("░", 20-percent/5)
				fmt.Printf("\rUploading: [%s] %d%% (%d/%d bytes)", bar, percent, current, total)
			}
		}

		result, err = client.UploadFileWithProgress(ctx, file, fileName, targetFolder, fileInfo.Size(), progress)
		if err != nil {
			fmt.Println() // New line after progress bar
			return fmt.Errorf("failed to upload file: %w", err)
		}
		fmt.Println() // New line after progress bar
	}

	out.Success(fmt.Sprintf("File uploaded successfully: %s", result["message"]))
	return nil
}

func runFileList(cmd *cobra.Command, args []string) error {
	ctx := context.Background()
	client := GetClient()
	out := GetFormatter()

	folder := ""
	if len(args) > 0 {
		folder = args[0]
	}

	out.Info(fmt.Sprintf("Listing files in %s...", folder))

	// List files
	response, err := client.ListFiles(ctx, folder)
	if err != nil {
		return fmt.Errorf("failed to list files: %w", err)
	}

	if len(response.Items) == 0 {
		out.Info("No files or folders found")
		return nil
	}

	// Print table header
	fmt.Printf("\n%-8s  %-40s  %12s  %s\n", "TYPE", "NAME", "SIZE", "MODIFIED")
	fmt.Println(strings.Repeat("-", 100))

	// Print items
	for _, item := range response.Items {
		typeStr := "FILE"
		if item.Type == "directory" {
			typeStr = "DIR"
		}

		sizeStr := fmt.Sprintf("%d B", item.Size)
		if item.Type == "directory" {
			sizeStr = "-"
		} else if item.Size > 1024*1024 {
			sizeStr = fmt.Sprintf("%.2f MB", float64(item.Size)/(1024*1024))
		} else if item.Size > 1024 {
			sizeStr = fmt.Sprintf("%.2f KB", float64(item.Size)/1024)
		}

		modified := item.Modified.Format("2006-01-02 15:04:05")

		fmt.Printf("%-8s  %-40s  %12s  %s\n", typeStr, item.Name, sizeStr, modified)
	}

	fmt.Printf("\nTotal: %d items\n", len(response.Items))
	return nil
}

func runFileUploadBulk(cmd *cobra.Command, args []string) error {
	ctx := context.Background()
	client := GetClient()
	out := GetFormatter()

	pattern := args[0]
	targetFolder := args[1]

	// Find matching files
	matches, err := filepath.Glob(pattern)
	if err != nil {
		return fmt.Errorf("invalid glob pattern: %w", err)
	}

	if len(matches) == 0 {
		return fmt.Errorf("no files match pattern: %s", pattern)
	}

	// Filter out directories
	var files []string
	for _, match := range matches {
		info, err := os.Stat(match)
		if err != nil {
			continue
		}
		if !info.IsDir() {
			files = append(files, match)
		}
	}

	if len(files) == 0 {
		return fmt.Errorf("no files match pattern (directories excluded): %s", pattern)
	}

	out.Info(fmt.Sprintf("Uploading %d files to %s...", len(files), targetFolder))

	// Upload with or without progress
	var result map[string]interface{}
	if uploadNoProgress {
		result, err = client.UploadMultipleFiles(ctx, files, targetFolder, nil)
		if err != nil {
			return fmt.Errorf("failed to upload files: %w", err)
		}
	} else {
		// Show progress bar
		var lastPercent int
		progress := func(current, total int64) {
			if total == 0 {
				return
			}
			percent := int((float64(current) / float64(total)) * 100)
			if percent > lastPercent {
				lastPercent = percent
				bar := strings.Repeat("█", percent/5) + strings.Repeat("░", 20-percent/5)
				fmt.Printf("\rUploading: [%s] %d%% (%d/%d bytes)", bar, percent, current, total)
			}
		}

		result, err = client.UploadMultipleFiles(ctx, files, targetFolder, progress)
		if err != nil {
			fmt.Println() // New line after progress bar
			return fmt.Errorf("failed to upload files: %w", err)
		}
		fmt.Println() // New line after progress bar
	}

	// Report results
	uploaded := int(result["uploaded"].(float64))
	failed := int(result["failed"].(float64))

	if failed > 0 {
		out.Info(fmt.Sprintf("Uploaded %d of %d files (%d failed)", uploaded, len(files), failed))
		if errors, ok := result["errors"].([]interface{}); ok && len(errors) > 0 {
			out.Error("Errors:")
			for _, err := range errors {
				out.Error(fmt.Sprintf("  - %s", err))
			}
		}
	} else {
		out.Success(fmt.Sprintf("All %d files uploaded successfully", uploaded))
	}

	return nil
}

func runFileDownload(cmd *cobra.Command, args []string) error {
	ctx := context.Background()
	client := GetClient()
	out := GetFormatter()

	sourcePath := args[0]
	destPath := args[1]

	// Parse source path to extract folder and filename
	sourceDir := filepath.Dir(sourcePath)
	sourceFile := filepath.Base(sourcePath)

	// Check if source looks like a file (has extension) or folder
	hasExtension := filepath.Ext(sourceFile) != ""

	if sourceDir == "." && hasExtension {
		return fmt.Errorf("source path must include folder: folder/filename or just folder for entire folder download")
	}

	// If source doesn't have an extension or sourceDir == sourcePath, treat as folder
	isFolder := !hasExtension || sourceDir == "." || sourcePath == sourceFile

	if isFolder {
		// Download entire folder as zip and extract
		folderPath := sourcePath
		if sourceDir != "." && sourceFile != "." {
			// Full path provided
			folderPath = sourcePath
		}

		out.Info(fmt.Sprintf("Downloading folder %s...", folderPath))

		// Determine destination path
		var finalDestPath string
		destInfo, err := os.Stat(destPath)
		if err == nil && destInfo.IsDir() {
			// Destination is a directory, use source folder name
			finalDestPath = filepath.Join(destPath, filepath.Base(folderPath))
		} else {
			// Destination is a new folder path
			finalDestPath = destPath
		}

		// Create destination directory
		if err := os.MkdirAll(finalDestPath, 0755); err != nil {
			return fmt.Errorf("failed to create destination directory: %w", err)
		}

		// Download and extract folder
		if err := client.DownloadFolder(ctx, folderPath, finalDestPath); err != nil {
			return fmt.Errorf("failed to download folder: %w", err)
		}

		out.Success(fmt.Sprintf("Folder downloaded and extracted successfully: %s", finalDestPath))
	} else {
		// Download single file
		out.Info(fmt.Sprintf("Downloading %s/%s...", sourceDir, sourceFile))

		// Determine destination path
		var finalDestPath string
		destInfo, err := os.Stat(destPath)
		if err == nil && destInfo.IsDir() {
			// Destination is a directory, use source filename
			finalDestPath = filepath.Join(destPath, sourceFile)
		} else {
			// Destination is a file path
			finalDestPath = destPath
		}

		// Create destination directory if it doesn't exist
		destDir := filepath.Dir(finalDestPath)
		if err := os.MkdirAll(destDir, 0755); err != nil {
			return fmt.Errorf("failed to create destination directory: %w", err)
		}

		// Download the file
		reader, err := client.DownloadFile(ctx, sourceDir, sourceFile)
		if err != nil {
			return fmt.Errorf("failed to download file: %w", err)
		}
		defer reader.Close()

		// Create destination file
		destFile, err := os.Create(finalDestPath)
		if err != nil {
			return fmt.Errorf("failed to create destination file: %w", err)
		}
		defer destFile.Close()

		// Copy content
		written, err := io.Copy(destFile, reader)
		if err != nil {
			return fmt.Errorf("failed to write file: %w", err)
		}

		out.Success(fmt.Sprintf("File downloaded successfully: %s (%d bytes)", finalDestPath, written))
	}

	return nil
}
