import React, { useState, useEffect } from 'react';
import { FaArchive, FaTimes, FaSpinner } from 'react-icons/fa';
import { explorerService, type ArchiveFormat, formatFileSize } from '~/services/explorerService';

interface CompressModalProps {
  /** Paths to compress */
  paths: string[];
  /** Current directory (used for default output path) */
  currentPath: string;
  onClose: () => void;
  onComplete: (outputPath: string) => void;
}

/**
 * Modal for compressing selected files/directories into an archive.
 * Lets user choose format and output filename.
 */
export const CompressModal: React.FC<CompressModalProps> = ({ paths, currentPath, onClose, onComplete }) => {
  const [formats, setFormats] = useState<ArchiveFormat[]>([]);
  const [selectedFormat, setSelectedFormat] = useState('zip');
  const [archiveName, setArchiveName] = useState('');
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ entryCount: number; totalSize: number; originalSize: number } | null>(null);

  // Load formats and set default name
  useEffect(() => {
    explorerService.getArchiveFormats().then(resp => {
      setFormats(resp.writable);
    }).catch(() => {
      // Fallback formats
      setFormats([
        { format: 'zip', name: 'ZIP' },
        { format: 'tar.gz', name: 'TAR.GZ' },
        { format: 'tar', name: 'TAR' },
        { format: 'tar.bz2', name: 'TAR.BZ2' },
        { format: '7z', name: '7-Zip' },
      ]);
    });

    // Generate default archive name
    if (paths.length === 1) {
      const name = paths[0].split('/').pop() || 'archive';
      // Remove existing extension for files
      const baseName = name.includes('.') ? name.substring(0, name.lastIndexOf('.')) : name;
      setArchiveName(baseName);
    } else {
      setArchiveName('archive');
    }
  }, [paths]);

  const getExtension = (format: string) => {
    switch (format) {
      case 'tar.gz': return '.tar.gz';
      case 'tar.bz2': return '.tar.bz2';
      case '7z': return '.7z';
      case 'gz': return '.gz';
      default: return `.${format}`;
    }
  };

  const fullOutputPath = `${currentPath}/${archiveName}${getExtension(selectedFormat)}`;

  const handleCompress = async () => {
    if (!archiveName.trim()) {
      setError('Please enter an archive name');
      return;
    }

    setCompressing(true);
    setError(null);

    try {
      const res = await explorerService.compress(paths, fullOutputPath, selectedFormat);
      setResult({ entryCount: res.entryCount, totalSize: res.totalSize, originalSize: res.originalSize });
      // Auto-close after brief delay to show result
      setTimeout(() => onComplete(fullOutputPath), 1500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Compression failed');
      setCompressing(false);
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
            <FaArchive className="text-cyan-400" />
            <h2 className="text-lg font-semibold">Compress Files</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <FaTimes />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Selected files summary */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              {paths.length} item{paths.length !== 1 ? 's' : ''} selected
            </label>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 max-h-32 overflow-y-auto text-sm">
              {paths.map(p => (
                <div key={p} className="text-slate-300 truncate py-0.5">
                  {p.split('/').pop()}
                </div>
              ))}
            </div>
          </div>

          {/* Archive name */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Archive name</label>
            <input
              type="text"
              value={archiveName}
              onChange={e => setArchiveName(e.target.value)}
              disabled={compressing}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-50"
              placeholder="archive"
              autoFocus
            />
          </div>

          {/* Format selection */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Format</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {formats.map(f => (
                <button
                  key={f.format}
                  onClick={() => setSelectedFormat(f.format)}
                  disabled={compressing}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-medium border transition-colors
                    ${selectedFormat === f.format
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                    }
                    disabled:opacity-50
                  `}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          {/* Output path preview */}
          <div className="text-xs text-slate-500 bg-slate-800/30 px-3 py-2 rounded-lg font-mono truncate">
            → {fullOutputPath}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/50 text-rose-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 px-4 py-3 rounded-lg text-sm">
              Compressed {result.entryCount} files • {formatFileSize(result.originalSize)} → {formatFileSize(result.totalSize)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-800">
          <button
            onClick={onClose}
            disabled={compressing}
            className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCompress}
            disabled={compressing || !archiveName.trim() || !!result}
            className="px-5 py-2 text-sm font-medium bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {compressing ? (
              <>
                <FaSpinner className="animate-spin" />
                Compressing...
              </>
            ) : (
              'Compress'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
