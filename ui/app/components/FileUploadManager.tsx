import React, { useState, useRef, useEffect } from "react";
import { 
  FaUpload, FaDownload, FaFolder, FaFile, 
  FaTimes, FaCheck, FaSpinner, FaTrash, FaSearch 
} from "react-icons/fa";
import { fileUploadService, type FileDownloadParams } from "~/services/fileUploadService";

// Add a new prop to FileUploadManagerProps
interface FileUploadManagerProps {
  onFileUploaded?: (filePath: string) => void;
  defaultFolder?: string;
  compact?: boolean; // Add this
}

interface UploadedFile {
  fileName: string;
  filePath: string;
  uploadTime: Date;
  fileSize: string;
}

export const FileUploadManager: React.FC<FileUploadManagerProps> = ({ 
  onFileUploaded,
  defaultFolder = "uploads",
  compact = false // Default to false
}) => {
  // State
  const [uploadFolder, setUploadFolder] = useState(defaultFolder);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Load file list on mount and when folder changes
  useEffect(() => {
    fetchFileList();
  }, [uploadFolder]);

  // Fetch file list - this would connect to your API
  const fetchFileList = async () => {
    // In a real implementation, you would call an API to get the file list
    // For now, we'll just use what's stored in state
    try {
      // Simulated API call
      // const files = await fileUploadService.getFilesList(uploadFolder);
      // setUploadedFiles(files);
    } catch (error) {
      console.error("Failed to fetch file list:", error);
      setError("Failed to retrieve file list. Please try again.");
    }
  };

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Handle single file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setError(null);

      const file = files[0];
      
      // Create upload tracker
      const uploadTracker = setInterval(() => {
        setUploadProgress(prev => {
          const increment = Math.random() * 15;
          return Math.min(prev + increment, 95); // Cap at 95% until complete
        });
      }, 400);

      const response = await fileUploadService.uploadFile(file, uploadFolder);
      
      clearInterval(uploadTracker);
      setUploadProgress(100);

      if (response.success) {
        setSuccess(`File '${file.name}' uploaded successfully!`);
        
        // Add to uploadedFiles list
        const newFile: UploadedFile = {
          fileName: file.name,
          filePath: response.filePath,
          uploadTime: new Date(),
          fileSize: formatFileSize(file.size)
        };
        
        setUploadedFiles(prev => [...prev, newFile]);
        
        // Notify parent if callback provided
        if (onFileUploaded) {
          onFileUploaded(response.filePath);
        }
      } else {
        setError(response.message || "Upload failed");
      }
    } catch (error) {
      console.error("File upload error:", error);
      setError("Failed to upload file. Please try again.");
    } finally {
      setIsUploading(false);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Clear success message after 5 seconds
      if (success) {
        setTimeout(() => setSuccess(null), 5000);
      }
    }
  };

  // Handle folder upload
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setError(null);
      
      // Create upload tracker
      const uploadTracker = setInterval(() => {
        setUploadProgress(prev => {
          const increment = Math.random() * 10;
          return Math.min(prev + increment, 95); // Cap at 95% until complete
        });
      }, 300);

      const fileArray = Array.from(files);
      const response = await fileUploadService.uploadFolder(fileArray);
      
      clearInterval(uploadTracker);
      setUploadProgress(100);

      if (response.success) {
        setSuccess(`Folder uploaded successfully! ${response.filesUploaded} files processed.`);
        // Refresh file list
        fetchFileList();
      } else {
        setError(response.message || "Folder upload failed");
        if (response.errorFiles?.length) {
          setError(prev => `${prev || ""} Failed files: ${response.errorFiles.join(", ")}`);
        }
      }
    } catch (error) {
      console.error("Folder upload error:", error);
      setError("Failed to upload folder. Please try again.");
    } finally {
      setIsUploading(false);
      
      // Reset file input
      if (folderInputRef.current) {
        folderInputRef.current.value = '';
      }
      
      // Clear success message after 5 seconds
      if (success) {
        setTimeout(() => setSuccess(null), 5000);
      }
    }
  };

  // Handle file download
  const handleFileDownload = async (fileName: string) => {
    try {
      setError(null);
      
      const params: FileDownloadParams = {
        folder: uploadFolder,
        fileName
      };
      
      const blob = await fileUploadService.downloadFile(params);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setSuccess(`File '${fileName}' downloaded successfully!`);
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (error) {
      console.error("File download error:", error);
      setError("Failed to download file. Please try again.");
    }
  };

  // Handle file selection for batch operations
  const toggleFileSelection = (fileName: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(fileName)) {
      newSelection.delete(fileName);
    } else {
      newSelection.add(fileName);
    }
    setSelectedFiles(newSelection);
  };

  // Handle batch delete
  const handleDeleteSelected = async () => {
    if (selectedFiles.size === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedFiles.size} selected files?`)) {
      return;
    }
    
    // In a real implementation, you would call your API to delete files
    try {
      setIsUploading(true); // Reuse loading state
      
      // Simulated deletion
      // await Promise.all(
      //   Array.from(selectedFiles).map(fileName => 
      //     fileUploadService.deleteFile(uploadFolder, fileName)
      //   )
      // );
      
      // Remove deleted files from the list
      setUploadedFiles(prev => 
        prev.filter(file => !selectedFiles.has(file.fileName))
      );
      
      // Clear selection
      setSelectedFiles(new Set());
      setSuccess(`Successfully deleted ${selectedFiles.size} files.`);
    } catch (error) {
      console.error("Delete error:", error);
      setError("Failed to delete some files. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  // Filter files based on search query
  const filteredFiles = uploadedFiles.filter(file => 
    file.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Load recently uploaded files when the component mounts
  useEffect(() => {
    const loadRecentFiles = async () => {
      try {
        // For demo purposes, we'll populate with some sample files
        // In a real implementation, you would fetch from the API
        const demoFiles: UploadedFile[] = [
          {
            fileName: 'sample-config.json',
            filePath: `${uploadFolder}/sample-config.json`,
            uploadTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
            fileSize: '2.3 KB'
          },
          {
            fileName: 'readme.md',
            filePath: `${uploadFolder}/readme.md`,
            uploadTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
            fileSize: '1.1 KB'
          }
        ];
        
        setUploadedFiles(demoFiles);
      } catch (error) {
        console.error("Failed to load recent files:", error);
        setError("Failed to load recent files. Please try again.");
      }
    };
    
    loadRecentFiles();
  }, [uploadFolder]); // Re-run when folder changes

  return (
    <div className={`
      ${compact ? 'bg-transparent p-0' : 'card-elevated'} 
      text-white
    `}>
      {/* Header */}
      {!compact && <h2 className="text-xl font-semibold text-slate-100 mb-6">Manage Files</h2>}
      
      {/* Error and success messages */}
      {error && (
        <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded-xl mb-4 fade-in">
          <div className="flex-1">{error}</div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-500/10" title="Dismiss error">
            <FaTimes />
          </button>
        </div>
      )}
      
      {success && (
        <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-xl mb-4 fade-in">
          <FaCheck className="flex-shrink-0" />
          <div className="flex-1">{success}</div>
          <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-emerald-300 p-1 rounded hover:bg-emerald-500/10" title="Dismiss notification">
            <FaTimes />
          </button>
        </div>
      )}
      
      {/* Upload progress bar */}
      {isUploading && !compact && (
        <div className="mb-6">
          <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-cyan-500 to-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          <div className="text-sm text-slate-400 mt-2 text-center">
            {uploadProgress < 100 ? 'Uploading...' : 'Processing...'}
          </div>
        </div>
      )}
      
      {/* Upload controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Folder selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">
            Target Folder
          </label>
          <div className="flex">
            <input
              type="text"
              value={uploadFolder}
              onChange={(e) => setUploadFolder(e.target.value)}
              placeholder="Folder path (e.g., 'uploads/images')"
              title="Enter target folder path"
              className="flex-1 px-4 py-2.5 bg-slate-700/50 border border-slate-600 rounded-l-xl text-slate-100
                placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500
                transition-all duration-200"
              disabled={isUploading}
              aria-label="Target folder path"
            />
            <button
              onClick={fetchFileList}
              className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 border border-l-0 border-slate-600 
                rounded-r-xl flex items-center justify-center text-slate-400 hover:text-cyan-400 transition-colors"
              title="Refresh file list"
              disabled={isUploading}
            >
              <FaSearch />
            </button>
          </div>
        </div>
        
        {/* Upload buttons */}
        <div className="flex gap-3 items-end">
          {/* Single file upload */}
          <div className="flex-1">
            <label htmlFor="file-upload" className="sr-only">Choose a file to upload</label>
            <input
              id="file-upload"
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              disabled={isUploading}
              title="Choose a file to upload"
              aria-label="Choose a file to upload"
              placeholder="Choose a file to upload"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`
                w-full py-2.5 rounded-xl flex items-center justify-center gap-2 font-medium transition-all duration-200
                ${isUploading 
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                  : 'btn-primary'}
              `}
              disabled={isUploading}
            >
              {isUploading ? <FaSpinner className="animate-spin" /> : <FaUpload />}
              Upload File
            </button>
          </div>
          
          {/* Folder upload */}
          <div className="flex-1">
            <input
              type="file"
              ref={folderInputRef}
              onChange={handleFolderUpload}
              className="hidden"
              {...{ webkitdirectory: "" } as React.InputHTMLAttributes<HTMLInputElement>}
              multiple
              disabled={isUploading}
              title="Select a folder to upload"
            />
            <button
              onClick={() => folderInputRef.current?.click()}
              className={`
                w-full py-2.5 rounded-xl flex items-center justify-center gap-2 font-medium transition-all duration-200
                ${isUploading 
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                  : 'btn-success'}
              `}
              disabled={isUploading}
            >
              {isUploading ? <FaSpinner className="animate-spin" /> : <FaFolder />}
              Upload Folder
            </button>
          </div>
        </div>
      </div>
      
      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <label htmlFor="file-search" className="sr-only">Search files</label>
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
          <input
            id="file-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            title="Search files"
            className="w-full px-4 py-2.5 pl-10 bg-slate-700/50 border border-slate-600/50 rounded-xl text-slate-100
              placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500
              transition-all duration-200"
          />
        </div>
      </div>
      
      {/* Batch actions */}
      {selectedFiles.size > 0 && (
        <div className="mb-4 flex justify-between items-center bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-3 fade-in">
          <div className="text-sm text-cyan-400">
            {selectedFiles.size} file{selectedFiles.size > 1 ? 's' : ''} selected
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedFiles(new Set())}
              className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-700/50 transition-colors"
              title="Clear selection"
            >
              <FaTimes size={14} />
            </button>
            <button
              onClick={handleDeleteSelected}
              className="p-2 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-rose-500/10 transition-colors"
              title="Delete selected files"
            >
              <FaTrash size={14} />
            </button>
          </div>
        </div>
      )}
      
      {/* File list */}
      <div className="border border-slate-700/50 rounded-xl overflow-hidden">
        {filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <FaFolder className="w-12 h-12 mb-4 text-slate-600" />
            <p className="text-lg font-medium text-slate-400">No files found</p>
            <p className="text-sm text-slate-500 mt-1">Upload a file to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-800/80 border-b border-slate-700/50">
                <tr>
                  <th className="py-3 px-4 w-8">
                    <label className="sr-only" htmlFor="select-all-files">Select all files</label>
                    <input 
                      id="select-all-files"
                      type="checkbox"
                      checked={selectedFiles.size > 0 && selectedFiles.size === filteredFiles.length}
                      onChange={() => {
                        if (selectedFiles.size === filteredFiles.length) {
                          setSelectedFiles(new Set());
                        } else {
                          setSelectedFiles(new Set(filteredFiles.map(f => f.fileName)));
                        }
                      }}
                      className="checkbox-custom w-4 h-4"
                      title="Select all files"
                      aria-label="Select all files"
                    />
                  </th>
                  <th className="py-3 px-4 text-sm font-medium text-slate-400">Name</th>
                  <th className="py-3 px-4 text-sm font-medium text-slate-400">Size</th>
                  <th className="py-3 px-4 text-sm font-medium text-slate-400">Uploaded</th>
                  <th className="py-3 px-4 text-right text-sm font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file, index) => (
                  <tr 
                    key={file.fileName} 
                    className={`
                      border-t border-slate-700/30 transition-colors
                      ${selectedFiles.has(file.fileName) ? 'bg-cyan-500/5' : 'hover:bg-slate-800/50'}
                    `}
                  >
                    <td className="py-3 px-4">
                      <input 
                        type="checkbox"
                        checked={selectedFiles.has(file.fileName)}
                        onChange={() => toggleFileSelection(file.fileName)}
                        className="checkbox-custom w-4 h-4"
                        title={`Select ${file.fileName}`}
                        aria-label={`Select ${file.fileName}`}
                        id={`select-file-${index}`}
                      />
                      <label htmlFor={`select-file-${index}`} className="sr-only">
                        Select {file.fileName}
                      </label>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                          <FaFile className="text-cyan-400" size={14} />
                        </div>
                        <span className="truncate max-w-[200px] text-slate-200" title={file.fileName}>
                          {file.fileName}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-400 text-sm">
                      {file.fileSize}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-400 text-sm">
                      {file.uploadTime.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => handleFileDownload(file.fileName)}
                          className="p-2 text-slate-500 hover:text-emerald-400 rounded-lg hover:bg-emerald-500/10 transition-colors"
                          title="Download"
                        >
                          <FaDownload size={14} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete "${file.fileName}"?`)) {
                              setUploadedFiles(prev => 
                                prev.filter(f => f.fileName !== file.fileName)
                              );
                              setSuccess(`File '${file.fileName}' deleted.`);
                            }
                          }}
                          className="p-2 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                          title="Delete"
                        >
                          <FaTrash size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
