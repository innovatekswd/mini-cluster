import React, { useState, useEffect } from 'react';
import { FaTimes, FaFolder, FaFile, FaLock, FaUnlock } from 'react-icons/fa';
import { explorerService, type FileItem, type FileInfo, formatFileSize, formatDate } from '~/services/explorerService';

interface PropertiesDialogProps {
  item: FileItem;
  onClose: () => void;
}

export const PropertiesDialog: React.FC<PropertiesDialogProps> = ({ item, onClose }) => {
  const [info, setInfo] = useState<FileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadInfo = async () => {
      try {
        setLoading(true);
        const data = await explorerService.getInfo(item.path);
        setInfo(data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load properties');
      } finally {
        setLoading(false);
      }
    };
    loadInfo();
  }, [item.path]);

  // Keyboard handler for escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            {item.type === 'directory' ? (
              <FaFolder className="text-2xl text-amber-400" />
            ) : (
              <FaFile className="text-2xl text-slate-400" />
            )}
            <div>
              <h2 className="text-lg font-semibold text-white truncate max-w-[250px]">{item.name}</h2>
              <p className="text-xs text-slate-400 uppercase">{item.type === 'directory' ? 'Folder' : item.mimeType}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <FaTimes className="text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
            </div>
          ) : error ? (
            <div className="bg-rose-500/10 border border-rose-500/50 text-rose-400 px-4 py-3 rounded-xl">
              {error}
            </div>
          ) : info ? (
            <div className="space-y-4">
              {/* Basic Info */}
              <PropertySection title="General">
                <PropertyRow label="Full Path" value={info.path} isPath />
                <PropertyRow label="Size" value={formatFileSize(info.size)} />
                {item.type === 'directory' && item.itemCount !== undefined && (
                  <PropertyRow label="Contents" value={`${item.itemCount} items`} />
                )}
              </PropertySection>

              {/* Dates */}
              <PropertySection title="Dates">
                <PropertyRow label="Created" value={formatDate(info.created)} />
                <PropertyRow label="Modified" value={formatDate(info.modified)} />
              </PropertySection>

              {/* Permissions */}
              <PropertySection title="Permissions">
                <PropertyRow label="Mode" value={info.permissions} mono />
                <PropertyRow label="Owner" value={info.owner} />
                <PropertyRow label="Group" value={info.group} />
                <div className="flex items-center gap-4 mt-2">
                  <PermissionBadge label="Read" allowed={info.isReadable} />
                  <PermissionBadge label="Write" allowed={info.isWritable} />
                  <PermissionBadge label="Execute" allowed={info.isExecutable} />
                </div>
              </PropertySection>

              {/* File-specific info */}
              {item.type === 'file' && (
                <PropertySection title="File Details">
                  <PropertyRow label="MIME Type" value={info.mimeType} />
                  {info.encoding && <PropertyRow label="Encoding" value={info.encoding} />}
                </PropertySection>
              )}

              {/* Symlink info */}
              {info.isSymlink && (
                <PropertySection title="Symlink">
                  <PropertyRow label="Target" value={info.symlinkTarget || 'Unknown'} isPath />
                </PropertySection>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper components
const PropertySection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">{title}</h3>
    <div className="bg-slate-800/50 rounded-xl p-3 space-y-2">
      {children}
    </div>
  </div>
);

const PropertyRow: React.FC<{ label: string; value: string; isPath?: boolean; mono?: boolean }> = ({ 
  label, 
  value, 
  isPath,
  mono 
}) => (
  <div className="flex items-start gap-3 text-sm">
    <span className="text-slate-400 w-24 flex-shrink-0">{label}</span>
    <span 
      className={`text-white break-all ${mono ? 'font-mono' : ''} ${isPath ? 'text-xs bg-slate-700/50 px-2 py-1 rounded' : ''}`}
      title={value}
    >
      {value}
    </span>
  </div>
);

const PermissionBadge: React.FC<{ label: string; allowed: boolean }> = ({ label, allowed }) => (
  <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${
    allowed 
      ? 'bg-emerald-500/20 text-emerald-400' 
      : 'bg-slate-700 text-slate-500'
  }`}>
    {allowed ? <FaUnlock /> : <FaLock />}
    <span>{label}</span>
  </div>
);

export default PropertiesDialog;
