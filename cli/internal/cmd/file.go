package cmd

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"

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

func init() {
	rootCmd.AddCommand(fileCmd)
	fileCmd.AddCommand(fileUploadCmd)
	fileCmd.AddCommand(fileDownloadCmd)
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

	// Upload the file
	result, err := client.UploadFile(ctx, file, fileName, targetFolder)
	if err != nil {
		return fmt.Errorf("failed to upload file: %w", err)
	}

	out.Success(fmt.Sprintf("File uploaded successfully: %s", result["message"]))
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
