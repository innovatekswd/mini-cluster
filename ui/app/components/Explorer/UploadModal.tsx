import React, { useState, useCallback, useRef } from 'react';
import { FaUpload, FaTimes, FaCheck, FaSpinner, FaFile, FaExclamationTriangle } from 'react-icons/fa';
import { explorerService, formatFileSize } from '~/services/explorerService';

interface UploadFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

interface UploadModalProps {
  targetPath: string;
  onClose: () => void;
  onComplete: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ targetPath, onClose, onComplete }) => {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const uploadFiles: UploadFile[] = fileArray.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      status: 'pending',
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...uploadFiles]);
  }, []);

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
  };

  const uploadFiles = async () => {
    const pendingFiles = files.filter((f) => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsUploading(true);

    for (const uploadFile of pendingFiles) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, status: 'uploading', progress: 0 } : f
        )
      );

      try {
        await explorerService.upload(targetPath, [uploadFile.file], (progress) => {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id ? { ...f, progress } : f
            )
          );
        });

        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id ? { ...f, status: 'success', progress: 100 } : f
          )
        );
      } catch (err: any) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id
              ? { ...f, status: 'error', error: err.response?.data?.message || 'Upload failed' }
              : f
          )
        );
      }
    }

    setIsUploading(false);
    
    // Auto-close after all successful
    const allSuccess = files.every((f) => f.status === 'success' || f.status === 'error');
    if (allSuccess) {
      setTimeout(() => {
        onComplete();
      }, 1000);
    }
  };

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const successCount = files.filter((f) => f.status === 'success').length;
  const errorCount = files.filter((f) => f.status === 'error').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-white">Upload Files</h2>
            <p className="text-sm text-slate-400 truncate max-w-[300px]">
              to {targetPath}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <FaTimes className="text-slate-400" />
          </button>
        </div>

        {/* Drop Zone */}
        <div className="p-6">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
              transition-colors
              ${isDragging
                ? 'border-cyan-500 bg-cyan-500/10'
                : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/50'
              }
            `}
          >
            <FaUpload className={`text-4xl mx-auto mb-3 ${isDragging ? 'text-cyan-400' : 'text-slate-500'}`} />
            <p className="text-slate-300 mb-1">
              {isDragging ? 'Drop files here' : 'Drop files here or click to browse'}
            </p>
            <p className="text-sm text-slate-500">
              Maximum file size: 100MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="px-6 pb-4 max-h-64 overflow-y-auto">
            <div className="space-y-2">
              {files.map((uploadFile) => (
                <div
                  key={uploadFile.id}
                  className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg"
                >
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    {uploadFile.status === 'pending' && <FaFile className="text-slate-400" />}
                    {uploadFile.status === 'uploading' && <FaSpinner className="text-cyan-400 animate-spin" />}
                    {uploadFile.status === 'success' && <FaCheck className="text-emerald-400" />}
                    {uploadFile.status === 'error' && <FaExclamationTriangle className="text-rose-400" />}
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{uploadFile.file.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatFileSize(uploadFile.file.size)}
                      {uploadFile.error && (
                        <span className="text-rose-400 ml-2">{uploadFile.error}</span>
                      )}
                    </p>
                    
                    {/* Progress bar */}
                    {uploadFile.status === 'uploading' && (
                      <div className="mt-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-500 transition-all duration-300"
                          style={{ width: `${uploadFile.progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Remove button */}
                  {uploadFile.status === 'pending' && (
                    <button
                      onClick={() => removeFile(uploadFile.id)}
                      className="p-1.5 hover:bg-slate-700 rounded transition-colors"
                    >
                      <FaTimes className="text-slate-500 text-sm" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700">
          <div className="text-sm text-slate-400">
            {files.length > 0 && (
              <>
                {pendingCount > 0 && <span>{pendingCount} pending</span>}
                {successCount > 0 && <span className="text-emerald-400 ml-2">✓ {successCount} uploaded</span>}
                {errorCount > 0 && <span className="text-rose-400 ml-2">✗ {errorCount} failed</span>}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={uploadFiles}
              disabled={pendingCount === 0 || isUploading}
              className={`
                px-4 py-2 text-sm rounded-lg font-medium transition-all
                ${pendingCount > 0 && !isUploading
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-white'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }
              `}
            >
              {isUploading ? (
                <span className="flex items-center gap-2">
                  <FaSpinner className="animate-spin" />
                  Uploading...
                </span>
              ) : (
                `Upload ${pendingCount > 0 ? `(${pendingCount})` : ''}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadModal;
