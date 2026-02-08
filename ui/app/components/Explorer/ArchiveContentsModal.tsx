import React, { useState, useEffect } from 'react';
import { FaArchive, FaTimes, FaSpinner, FaFolder, FaFile } from 'react-icons/fa';
import { explorerService, type ArchiveEntry, formatFileSize } from '~/services/explorerService';

interface ArchiveContentsModalProps {
  /** Path to the archive file */
  archivePath: string;
  onClose: () => void;
  /** Called when user wants to extract */
  onExtract: () => void;
}

/**
 * Modal that shows the contents of an archive file without extracting.
 */
export const ArchiveContentsModal: React.FC<ArchiveContentsModalProps> = ({ archivePath, onClose, onExtract }) => {
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState('');
  const [totalSize, setTotalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await explorerService.getArchiveContents(archivePath);
        setEntries(result.entries);
        setFormat(result.format);
        setTotalSize(result.totalSize);
        setCompressedSize(result.compressedSize);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to read archive');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [archivePath]);

  const fileName = archivePath.split('/').pop() || 'Archive';
  const ratio = totalSize > 0 ? ((1 - compressedSize / totalSize) * 100).toFixed(1) : '0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-none">
          <div className="flex items-center gap-3 min-w-0">
            <FaArchive className="text-amber-400 flex-none" />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold truncate">{fileName}</h2>
              {format && (
                <span className="text-xs text-slate-500 uppercase">{format} archive</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors flex-none">
            <FaTimes />
          </button>
        </div>

        {/* Stats bar */}
        {!loading && !error && (
          <div className="flex items-center gap-6 px-6 py-3 border-b border-slate-800/50 text-xs text-slate-400 flex-none">
            <span>{entries.length} entries</span>
            <span>Uncompressed: {formatFileSize(totalSize)}</span>
            <span>Compressed: {formatFileSize(compressedSize)}</span>
            <span>Ratio: {ratio}%</span>
          </div>
        )}

        {/* Contents */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <FaSpinner className="animate-spin text-2xl text-cyan-400" />
            </div>
          ) : error ? (
            <div className="px-6 py-8 text-center">
              <div className="bg-rose-500/10 border border-rose-500/50 text-rose-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <FaArchive className="text-3xl mb-3 opacity-50" />
              <p>Archive is empty</p>
            </div>
          ) : (
            <div>
              {/* Column headers */}
              <div className="flex items-center gap-3 px-4 py-2 text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800/50 sticky top-0 bg-slate-900">
                <div className="w-5"></div>
                <div className="flex-1">Path</div>
                <div className="w-24 text-right">Size</div>
                <div className="w-24 text-right hidden sm:block">Compressed</div>
              </div>
              {entries.map((entry, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 px-4 py-1.5 text-sm border-b border-slate-800/30 hover:bg-slate-800/20"
                >
                  <div className="w-5 text-center flex-none">
                    {entry.isDirectory ? (
                      <FaFolder className="text-amber-400 text-xs" />
                    ) : (
                      <FaFile className="text-slate-500 text-xs" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 truncate text-slate-300 font-mono text-xs">
                    {entry.path}
                  </div>
                  <div className="w-24 text-right text-xs text-slate-500 flex-none">
                    {entry.isDirectory ? '-' : formatFileSize(entry.size)}
                  </div>
                  <div className="w-24 text-right text-xs text-slate-500 hidden sm:block flex-none">
                    {entry.isDirectory ? '-' : formatFileSize(entry.compressedSize)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-800 flex-none">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
          >
            Close
          </button>
          <button
            onClick={onExtract}
            disabled={loading || !!error}
            className="px-5 py-2 text-sm font-medium bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors disabled:opacity-50"
          >
            Extract...
          </button>
        </div>
      </div>
    </div>
  );
};
