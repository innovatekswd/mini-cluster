# File Upload and Download Commands

The MiniCluster CLI now supports uploading and downloading files to/from the server.

## Commands

### Upload a File

Upload a file from your local machine to the MiniCluster server.

```bash
mc file upload <source> <destination-folder>
```

**Arguments:**
- `source`: Local file path
- `destination-folder`: Target folder on the server

**Examples:**

```bash
# Upload a single file to the 'prod' folder
mc file upload ./config.json prod

# Upload a file to a nested folder structure
mc file upload ~/data.csv backup/data

# Upload a file with spaces in the name
mc file upload "./my app/config.yml" production
```

### Download a File

Download a file from the MiniCluster server to your local machine.

```bash
mc file download <source-path> <destination>
```

**Arguments:**
- `source-path`: File path on the server in the format `folder/filename`
- `destination`: Local destination path (file or directory)

**Examples:**

```bash
# Download a file to a specific location
mc file download prod/config.json ./config.json

# Download to a directory (uses source filename)
mc file download backup/data/data.csv ~/downloads/

# Download a file with spaces in the name
mc file download "production/my config.yml" ./config.yml
```

### Download a Folder

Download an entire folder from the server. The folder is automatically zipped on the server and extracted locally.

```bash
mc file download <folder-path> <destination>
```

**Arguments:**
- `folder-path`: Folder path on the server (without filename)
- `destination`: Local destination directory

**Examples:**

```bash
# Download entire folder
mc file download prod/configs ./local-configs

# Download to existing directory (creates subfolder)
mc file download backup/2026-01 ~/backups/

# Download nested folders
mc file download prod/app/configs ./configs
```

**How it works:**
1. Server creates a zip archive of the entire folder (including subdirectories)
2. CLI downloads the zip file
3. CLI automatically extracts it to the destination
4. Original folder structure is preserved

## API Endpoints

The CLI uses the following API endpoints:

- **Upload**: `POST /api/files/upload`
  - Form fields: `File` (file), `Folder` (string)
  
- **Download File**: `GET /api/files/download?folder=<folder>&fileName=<filename>`
  - Returns: File content (application/octet-stream)

- **Download Folder**: `GET /api/files/download?folder=<folder>`
  - Returns: Zip archive (application/zip)
  - Automatically includes all subdirectories and files

## Authentication

File upload and download commands require authentication. Make sure you're logged in:

```bash
mc login
```

## Global Flags

All file commands support the standard global flags:

- `--debug`: Show API calls and responses
- `--server, -s`: Override server URL
- `--token, -t`: Override authentication token
- `--output, -o`: Output format (table, json, yaml, quiet)
- `--timeout`: Request timeout duration
- `--yes, -y`: Skip confirmation prompts
/folder exists locally (for upload) or on the server (for download)
2. **Authentication required**: Run `mc login` first
3. **Permission denied**: Check file/folder permissions
4. **Path traversal**: The CLI sanitizes paths to prevent directory traversal attacks
5. **Zip extraction failed**: Check destination permissions and disk space

## Notes

- Files are stored on the server in the `UploadedFiles` directory
- Folder paths are relative and automatically sanitized
- Large file uploads respect server timeout settings
- Downloads stream directly to disk for memory efficiency
- Folder downloads are automatically zipped and extracted
- Original folder structure is preserved in folder downloads
- Empty folders are preserved in zip archives

- Files are stored on the server in the `UploadedFiles` directory
- Folder paths are relative and automatically sanitized
- Large file uploads respect server timeout settings
- Downloads stream directly to disk for memory efficiency
