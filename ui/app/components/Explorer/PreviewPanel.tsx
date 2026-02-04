import React, { useState, useEffect, lazy, Suspense } from 'react';
import { FaTimes, FaFile, FaDownload } from 'react-icons/fa';
import { FileIcon } from './FileIcon';
import { explorerService, type FileItem } from '~/services/explorerService';

// Lazy load Monaco Editor to reduce initial bundle size
const Editor = lazy(() => import('@monaco-editor/react'));

interface PreviewPanelProps {
  item: FileItem | null;
  onClose: () => void;
  onSave?: (content: string) => void;
}

/**
 * Get Monaco language from file extension
 */
const getLanguage = (ext: string): string => {
  const map: Record<string, string> = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.json': 'json',
    '.xml': 'xml',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.md': 'markdown',
    '.py': 'python',
    '.cs': 'csharp',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.sql': 'sql',
    '.sh': 'shell',
    '.bash': 'shell',
  };
  return map[ext] || 'plaintext';
};

/**
 * Loading fallback for Monaco Editor
 */
const EditorLoading: React.FC = () => (
  <div className="flex items-center justify-center h-full bg-slate-900">
    <div className="text-center">
      <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-3" />
      <p className="text-sm text-slate-400">Loading editor...</p>
    </div>
  </div>
);

/**
 * Preview panel component for viewing/editing files
 */
export const PreviewPanel = React.memo<PreviewPanelProps>(({ item, onClose, onSave }) => {
  const [content, setContent] = useState<string>('');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!item || item.type === 'directory') return;

    setLoading(true);
    setIsDirty(false);
    setBlobUrl(null);
    setContent('');

    if (item.category === 'text') {
      explorerService.getFileContent(item.path)
        .then(setContent)
        .finally(() => setLoading(false));
    } else if (['image', 'video', 'audio'].includes(item.category)) {
      explorerService.getFileBlob(item.path)
        .then(blob => {
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [item]);

  if (!item) return null;

  const handleSave = () => {
    if (onSave && isDirty) {
      onSave(content);
      setIsDirty(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div 
      className="h-full flex flex-col bg-slate-900 border-l border-slate-700"
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2 min-w-0">
          <FileIcon item={item} />
          <span className="truncate font-medium">{item.name}</span>
          {isDirty && (
            <span className="text-amber-400" title="Unsaved changes" aria-label="Unsaved changes">
              ●
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isDirty && onSave && (
            <button
              onClick={handleSave}
              className="px-3 py-1.5 text-sm bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg transition-colors"
              aria-label="Save changes"
            >
              Save
            </button>
          )}
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-700 rounded-lg"
            aria-label="Close preview"
          >
            <FaTimes aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
          </div>
        ) : item.category === 'text' ? (
          <Suspense fallback={<EditorLoading />}>
            <Editor
              height="100%"
              language={getLanguage(item.extension)}
              value={content}
              onChange={(value) => {
                setContent(value || '');
                setIsDirty(true);
              }}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                wordWrap: 'on',
                readOnly: !item.isWritable,
                accessibilitySupport: 'on',
              }}
            />
          </Suspense>
        ) : item.category === 'image' && blobUrl ? (
          <div className="h-full flex items-center justify-center p-4 overflow-auto">
            <img 
              src={blobUrl} 
              alt={item.name} 
              className="max-w-full max-h-full object-contain" 
            />
          </div>
        ) : item.category === 'video' && blobUrl ? (
          <div className="h-full flex items-center justify-center p-4">
            <video 
              src={blobUrl} 
              controls 
              className="max-w-full max-h-full"
              aria-label={`Video: ${item.name}`}
            />
          </div>
        ) : item.category === 'audio' && blobUrl ? (
          <div className="h-full flex items-center justify-center p-4">
            <audio 
              src={blobUrl} 
              controls 
              className="w-full max-w-md"
              aria-label={`Audio: ${item.name}`}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <FaFile className="text-4xl mb-2" aria-hidden="true" />
            <p>Binary file - cannot preview</p>
            <button
              onClick={() => explorerService.downloadFile(item.path)}
              className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg flex items-center gap-2"
              aria-label={`Download ${item.name}`}
            >
              <FaDownload aria-hidden="true" /> Download
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

PreviewPanel.displayName = 'PreviewPanel';

export default PreviewPanel;
