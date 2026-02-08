import React, { useState } from 'react';
import { FaArchive, FaTimes, FaSpinner } from 'react-icons/fa';
import { explorerService, formatFileSize } from '~/services/explorerService';

interface ExtractModalProps {
  /** Path to the archive file to extract */
  archivePath: string;
  /** Current directory path (used as default destination) */
  currentPath: string;
  onClose: () => void;
  onComplete: (destinationPath: string) => void;
}

/**
 * Modal for extracting an archive to a destination directory.
 */
export const ExtractModal: React.FC<ExtractModalProps> = ({ archivePath, currentPath, onClose, onComplete }) => {
  // Default: extract to a folder named after the archive (without extension)
  const archiveFileName = archivePath.split('/').pop() || 'archive';
  const defaultFolderName = archiveFileName.replace(/\.(zip|tar\.gz|tgz|tar\.bz2|tbz2|tar\.xz|txz|tar|7z|rar|gz|bz2|xz|lz|lzma)$/i, '');

  const [folderName, setFolderName] = useState(defaultFolderName);
  const [overwrite, setOverwrite] = useState(false);
  const [extractHere, setExtractHere] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ entryCount: number; totalSize: number } | null>(null);

  const destinationPath = extractHere ? currentPath : `${currentPath}/${folderName}`;

  const handleExtract = async () => {
    setExtracting(true);
    setError(null);

    try {
      const res = await explorerService.extract(archivePath, destinationPath, overwrite);
      setResult({ entryCount: res.entryCount, totalSize: res.totalSize });
      setTimeout(() => onComplete(destinationPath), 1500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Extraction failed');
      setExtracting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <FaArchive className="text-amber-400" />
            <h2 className="text-lg font-semibold">Extract Archive</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <FaTimes />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Archive name */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Archive</label>
            <div className="text-sm text-slate-300 bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 truncate font-mono">
              {archiveFileName}
            </div>
          </div>

          {/* Extract here toggle */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={extractHere}
              onChange={e => setExtractHere(e.target.checked)}
              disabled={extracting}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500/50"
            />
            <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
              Extract to current directory
            </span>
          </label>

          {/* Destination folder name */}
          {!extractHere && (
            <div>
              <label className="block text-sm text-slate-400 mb-2">Extract to folder</label>
              <input
                type="text"
                value={folderName}
                onChange={e => setFolderName(e.target.value)}
                disabled={extracting}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-50"
                placeholder="folder name"
                autoFocus
              />
            </div>
          )}

          {/* Destination path preview */}
          <div className="text-xs text-slate-500 bg-slate-800/30 px-3 py-2 rounded-lg font-mono truncate">
            → {destinationPath}
          </div>

          {/* Overwrite toggle */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={e => setOverwrite(e.target.checked)}
              disabled={extracting}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500/50"
            />
            <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
              Overwrite existing files
            </span>
          </label>

          {/* Error */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/50 text-rose-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 px-4 py-3 rounded-lg text-sm">
              Extracted {result.entryCount} files ({formatFileSize(result.totalSize)})
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-800">
          <button
            onClick={onClose}
            disabled={extracting}
            className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExtract}
            disabled={extracting || (!extractHere && !folderName.trim()) || !!result}
            className="px-5 py-2 text-sm font-medium bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {extracting ? (
              <>
                <FaSpinner className="animate-spin" />
                Extracting...
              </>
            ) : (
              'Extract'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
