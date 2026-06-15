import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FaFolder,
  FaChevronRight,
  FaSync,
  FaUpload,
  FaSearch,
  FaTimes,
  FaTerminal,
  FaArrowLeft,
  FaExpand,
  FaCompress,
  FaFile,
} from 'react-icons/fa';
import {
  explorerService,
  type FileItem,
  type DirectoryListing,
  isEditable,
  isPreviewable,
} from '~/services/explorerService';
import { AddressBar } from './AddressBar';
import { FileGrid } from './FileGrid';
import { ContextMenu } from './ContextMenu';
import { PreviewPanel } from './PreviewPanel';
import { UploadModal } from './UploadModal';
import { NewItemModal } from './NewItemModal';
import { RenameModal } from './RenameModal';
import { PropertiesDialog } from './PropertiesDialog';
import { TerminalPanel } from './TerminalPanel';
import { CompressModal } from './CompressModal';
import { ExtractModal } from './ExtractModal';
import { ArchiveContentsModal } from './ArchiveContentsModal';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useConfirm } from '~/components/ConfirmDialog';

interface ExplorerPageProps {
  initialPath?: string;
  machineId?: string;
  onNavigate?: (path: string) => void;
  onMachineChange?: (machineId: string) => void;
}

// Main Explorer component
export const ExplorerPage: React.FC<ExplorerPageProps> = ({ initialPath = '', machineId = 'local', onNavigate, onMachineChange }) => {
  const { confirm } = useConfirm();
  const [roots, setRoots] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [listing, setListing] = useState<DirectoryListing | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [previewItem, setPreviewItem] = useState<FileItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: FileItem | null } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [sortField, setSortField] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ file: string; progress: number }[]>([]);
  const dragCounter = useRef(0);

  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [newItemType, setNewItemType] = useState<'file' | 'folder'>('file');
  const [renameItem, setRenameItem] = useState<FileItem | null>(null);
  const [propertiesItem, setPropertiesItem] = useState<FileItem | null>(null);
  
  // Terminal state
  const [terminalPath, setTerminalPath] = useState<string | null>(null);
  const [isTerminalMaximized, setIsTerminalMaximized] = useState(false);

  // Clipboard state for copy/cut operations
  const [clipboard, setClipboard] = useState<{ items: string[]; action: 'copy' | 'cut' } | null>(null);

  // Archive modal states
  const [compressPaths, setCompressPaths] = useState<string[] | null>(null);
  const [extractArchivePath, setExtractArchivePath] = useState<string | null>(null);
  const [archiveContentsPath, setArchiveContentsPath] = useState<string | null>(null);

  // Load roots on mount, restore from URL path
  useEffect(() => {
    loadRoots();
  }, []);

  // Sync currentPath to URL via onNavigate callback
  useEffect(() => {
    if (currentPath && onNavigate) {
      onNavigate(currentPath);
    }
  }, [currentPath]);

  const loadRoots = async () => {
    try {
      setLoading(true);
      const rootPaths = await explorerService.getRoots();
      setRoots(rootPaths);
      // Restore directory from URL path
      if (initialPath) {
        loadDirectory(initialPath);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load root paths');
    } finally {
      setLoading(false);
    }
  };

  const loadDirectory = useCallback(async (path: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await explorerService.listDirectory(path, sortField, sortOrder);
      setListing({
        ...data,
        items: Array.isArray(data.items) ? data.items : [],
      });
      setCurrentPath(path);
      setSelectedItems(new Set());
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  }, [sortField, sortOrder]);

  const handleNavigate = (path: string) => {
    if (path === '') {
      setCurrentPath('');
      setListing(null);
    } else {
      loadDirectory(path);
    }
  };



  const handleOpen = (item: FileItem) => {
    if (item.type === 'directory') {
      loadDirectory(item.path);
    } else if (isPreviewable(item)) {
      setPreviewItem(item);
    } else {
      explorerService.downloadFile(item.path);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, item: FileItem) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
    setSelectedItems(new Set([item.path]));
  };

  const handleContextAction = async (action: string) => {
    const item = contextMenu?.item;
    setContextMenu(null);
    if (!item) return;

    switch (action) {
      case 'open':
        handleOpen(item);
        break;
      case 'edit':
      case 'preview':
        setPreviewItem(item);
        break;
      case 'download':
        explorerService.downloadFile(item.path);
        break;
      case 'copy':
        setClipboard({ items: [item.path], action: 'copy' });
        break;
      case 'cut':
        setClipboard({ items: [item.path], action: 'cut' });
        break;
      case 'rename':
        setRenameItem(item);
        break;
      case 'delete':
        const confirmed = await confirm({
          title: 'Delete Item',
          message: `Are you sure you want to delete "${item.name}"?`,
          confirmLabel: 'Delete',
          variant: 'danger',
        });
        if (confirmed) {
          try {
            await explorerService.delete(item.path, item.type === 'directory');
            loadDirectory(currentPath);
          } catch (err: any) {
            setError(err.response?.data?.message || 'Delete failed');
          }
        }
        break;
      case 'terminal':
        // Open terminal at this path
        const termPath = item.type === 'directory' ? item.path : currentPath;
        setTerminalPath(termPath);
        break;
      case 'compress':
        setCompressPaths([item.path]);
        break;
      case 'extract':
        setExtractArchivePath(item.path);
        break;
      case 'archive-contents':
        setArchiveContentsPath(item.path);
        break;
      case 'properties':
        setPropertiesItem(item);
        break;
    }
  };

  // Handle rename operation
  const handleRenameComplete = () => {
    setRenameItem(null);
    loadDirectory(currentPath);
  };

  // Handle new file/folder creation
  const handleCreateComplete = () => {
    setShowNewItemModal(false);
    loadDirectory(currentPath);
  };

  // Handle upload completion
  const handleUploadComplete = () => {
    setShowUploadModal(false);
    loadDirectory(currentPath);
  };

  const handleSaveFile = async (content: string) => {
    if (!previewItem) return;
    try {
      await explorerService.saveFile(previewItem.path, content);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Save failed');
    }
  };

  const handleRefresh = () => {
    if (currentPath) {
      loadDirectory(currentPath);
    } else {
      loadRoots();
    }
  };

  // Clipboard operations
  const handleCopy = useCallback(() => {
    if (selectedItems.size > 0) {
      setClipboard({ items: Array.from(selectedItems), action: 'copy' });
    }
  }, [selectedItems]);

  const handleCut = useCallback(() => {
    if (selectedItems.size > 0) {
      setClipboard({ items: Array.from(selectedItems), action: 'cut' });
    }
  }, [selectedItems]);

  const handlePaste = useCallback(async () => {
    if (!clipboard || !currentPath) return;
    
    try {
      for (const sourcePath of clipboard.items) {
        const fileName = sourcePath.split('/').pop() || '';
        const destPath = `${currentPath}/${fileName}`;
        
        if (clipboard.action === 'copy') {
          await explorerService.copy(sourcePath, destPath);
        } else {
          await explorerService.move(sourcePath, destPath);
        }
      }
      
      if (clipboard.action === 'cut') {
        setClipboard(null);
      }
      
      loadDirectory(currentPath);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Paste failed');
    }
  }, [clipboard, currentPath, loadDirectory]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedItems.size === 0) return;
    
    const itemsStr = selectedItems.size === 1 
      ? 'this item' 
      : `${selectedItems.size} items`;
    
    const confirmed = await confirm({
      title: 'Delete Items',
      message: `Are you sure you want to delete ${itemsStr}?`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    
    if (confirmed) {
      try {
        for (const path of selectedItems) {
          const item = listing?.items.find(i => i.path === path);
          await explorerService.delete(path, item?.type === 'directory');
        }
        loadDirectory(currentPath);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Delete failed');
      }
    }
  }, [selectedItems, currentPath, listing, loadDirectory, confirm]);

  const handleRenameSelected = useCallback(() => {
    if (selectedItems.size === 1) {
      const path = Array.from(selectedItems)[0];
      const item = listing?.items.find(i => i.path === path);
      if (item) {
        setRenameItem(item);
      }
    }
  }, [selectedItems, listing]);

  const handleSelectAll = useCallback(() => {
    if (listing?.items) {
      setSelectedItems(new Set(listing.items.map(i => i.path)));
    }
  }, [listing]);

  const handleEscape = useCallback(() => {
    if (contextMenu) {
      setContextMenu(null);
    } else if (previewItem) {
      setPreviewItem(null);
    } else if (selectedItems.size > 0) {
      setSelectedItems(new Set());
    }
  }, [contextMenu, previewItem, selectedItems]);

  const handleNavigateUp = useCallback(() => {
    if (listing?.parent) {
      handleNavigate(listing.parent);
    }
  }, [listing, handleNavigate]);

  // Register keyboard shortcuts
  useKeyboardShortcuts({
    selectedItems,
    previewItem,
    currentPath,
    onDelete: handleDeleteSelected,
    onCopy: handleCopy,
    onCut: handleCut,
    onPaste: handlePaste,
    onRename: handleRenameSelected,
    onRefresh: handleRefresh,
    onNewFile: () => { setNewItemType('file'); setShowNewItemModal(true); },
    onNewFolder: () => { setNewItemType('folder'); setShowNewItemModal(true); },
    onUpload: () => setShowUploadModal(true),
    onSelectAll: handleSelectAll,
    onEscape: handleEscape,
    onNavigateUp: handleNavigateUp,
    enabled: !!currentPath && !showUploadModal && !showNewItemModal && !renameItem,
  });

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    if (!currentPath) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Initialize progress tracking
    setUploadProgress(files.map(f => ({ file: f.name, progress: 0 })));

    // Upload files sequentially
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        await explorerService.uploadFile(currentPath, file, (progress) => {
          setUploadProgress(prev => 
            prev.map((p, idx) => idx === i ? { ...p, progress } : p)
          );
        });
      } catch (err: any) {
        setError(`Failed to upload ${file.name}: ${err.message}`);
      }
    }

    // Clear progress after a short delay
    setTimeout(() => {
      setUploadProgress([]);
      loadDirectory(currentPath);
    }, 1000);
  }, [currentPath, loadDirectory]);

  // Render root selection if no path
  if (!currentPath) {
    return (
      <div className={`h-full flex flex-col bg-slate-950 text-white ${isFullScreen ? 'fixed inset-0 z-50' : ''}`}>
        {/* Header */}
        <div className="flex-none flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <FaFolder className="text-2xl text-amber-400" />
            <h1 className="text-xl font-bold">Select a folder to browse</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleRefresh} className="icon-btn" title="Refresh">
              <FaSync className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Root paths */}
        <div className="flex-1 p-6">
          
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/50 text-rose-400 px-4 py-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roots.map(root => (
              <button
                key={root.path}
                onClick={() => loadDirectory(root.path)}
                className="flex items-center gap-4 p-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 rounded-xl transition-colors text-left group"
              >
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <FaFolder className="text-2xl text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{root.name}</div>
                  <div className="text-sm text-slate-500 truncate">{root.path}</div>
                </div>
                <FaChevronRight className="text-slate-500 group-hover:text-white transition-colors" />
              </button>
            ))}
          </div>

          {roots.length === 0 && !loading && (
            <div className="text-center text-slate-500 py-12">
              <FaFolder className="text-4xl mx-auto mb-3 opacity-50" />
              <p>No accessible folders configured</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col bg-slate-950 text-white ${isFullScreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Toolbar */}
      <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-slate-800 gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleNavigate(listing?.parent || '')}
            disabled={!listing?.parent}
            className="icon-btn"
            title="Go back"
          >
            <FaArrowLeft />
          </button>
          
          <AddressBar path={currentPath} onNavigate={handleNavigate} roots={roots} />
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative hidden md:block">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm w-48 focus:w-64 transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          </div>

          <button onClick={handleRefresh} className="icon-btn" title="Refresh">
            <FaSync className={loading ? 'animate-spin' : ''} />
          </button>
          
          <button 
            onClick={() => { setNewItemType('file'); setShowNewItemModal(true); }} 
            className="icon-btn" 
            title="New File"
          >
            <FaFile className="text-sm" />
          </button>
          
          <button 
            onClick={() => { setNewItemType('folder'); setShowNewItemModal(true); }} 
            className="icon-btn" 
            title="New Folder"
          >
            <FaFolder className="text-sm" />
          </button>
          
          <button 
            onClick={() => setShowUploadModal(true)} 
            className="icon-btn" 
            title="Upload"
          >
            <FaUpload />
          </button>
          
          <button 
            onClick={() => setTerminalPath(terminalPath ? null : currentPath)} 
            className={`icon-btn ${terminalPath ? 'text-green-400' : ''}`}
            title={terminalPath ? 'Close Terminal' : 'Open Terminal'}
          >
            <FaTerminal />
          </button>

          <button 
            onClick={() => setIsFullScreen(!isFullScreen)} 
            className="icon-btn" 
            title={isFullScreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullScreen ? <FaCompress /> : <FaExpand />}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 bg-rose-500/10 border border-rose-500/50 text-rose-400 px-4 py-3 rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <FaTimes />
          </button>
        </div>
      )}

      {/* Content */}
      <div 
        className="flex-1 flex min-h-0 relative"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-40 bg-cyan-500/10 border-2 border-dashed border-cyan-500 rounded-lg flex items-center justify-center pointer-events-none">
            <div className="bg-slate-900/90 px-8 py-6 rounded-xl text-center">
              <FaUpload className="text-4xl text-cyan-400 mx-auto mb-3" />
              <p className="text-lg font-medium text-white">Drop files to upload</p>
              <p className="text-sm text-slate-400">Files will be uploaded to {currentPath}</p>
            </div>
          </div>
        )}
        
        {/* Upload progress indicator */}
        {uploadProgress.length > 0 && (
          <div className="absolute bottom-4 right-4 z-50 bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-xl min-w-[280px]">
            <div className="text-sm font-medium text-white mb-3">Uploading {uploadProgress.length} file(s)</div>
            {uploadProgress.map((item, idx) => (
              <div key={idx} className="mb-2">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span className="truncate max-w-[180px]">{item.file}</span>
                  <span>{Math.round(item.progress)}%</span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-cyan-500 transition-all duration-200"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        {/* File list */}
        <div className={`flex-1 flex flex-col min-w-0 ${previewItem ? 'hidden md:flex md:w-1/2' : ''}`}>
          <FileGrid
            listing={listing}
            loading={loading}
            selectedItems={selectedItems}
            clipboard={clipboard}
            searchQuery={searchQuery}
            onOpen={handleOpen}
            onContextMenu={handleContextMenu}
            onSelectionChange={(paths: string[]) => setSelectedItems(new Set(paths))}
            onCompress={(paths: string[]) => setCompressPaths(paths)}
          />
        </div>

        {/* Preview panel */}
        {previewItem && (
          <div className="w-full md:w-1/2 border-l border-slate-700">
            <PreviewPanel
              item={previewItem}
              onClose={() => setPreviewItem(null)}
              onSave={isEditable(previewItem) ? handleSaveFile : undefined}
            />
          </div>
        )}
      </div>

      {/* Terminal panel */}
      {terminalPath && (
        <TerminalPanel
          workingDirectory={terminalPath}
          onClose={() => { setTerminalPath(null); setIsTerminalMaximized(false); }}
          isMaximized={isTerminalMaximized}
          onToggleMaximize={() => setIsTerminalMaximized(!isTerminalMaximized)}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          onClose={() => setContextMenu(null)}
          onAction={handleContextAction}
        />
      )}

      {/* Upload modal */}
      {showUploadModal && (
        <UploadModal
          targetPath={currentPath}
          onClose={() => setShowUploadModal(false)}
          onComplete={handleUploadComplete}
        />
      )}

      {/* New item modal */}
      {showNewItemModal && (
        <NewItemModal
          targetPath={currentPath}
          type={newItemType}
          onClose={() => setShowNewItemModal(false)}
          onCreated={handleCreateComplete}
        />
      )}

      {/* Rename modal */}
      {renameItem && (
        <RenameModal
          item={renameItem}
          onClose={() => setRenameItem(null)}
          onRenamed={handleRenameComplete}
        />
      )}

      {/* Properties dialog */}
      {propertiesItem && (
        <PropertiesDialog
          item={propertiesItem}
          onClose={() => setPropertiesItem(null)}
        />
      )}

      {/* Compress modal */}
      {compressPaths && compressPaths.length > 0 && (
        <CompressModal
          paths={compressPaths}
          currentPath={currentPath}
          onClose={() => setCompressPaths(null)}
          onComplete={() => {
            setCompressPaths(null);
            loadDirectory(currentPath);
          }}
        />
      )}

      {/* Extract modal */}
      {extractArchivePath && (
        <ExtractModal
          archivePath={extractArchivePath}
          currentPath={currentPath}
          onClose={() => setExtractArchivePath(null)}
          onComplete={() => {
            setExtractArchivePath(null);
            loadDirectory(currentPath);
          }}
        />
      )}

      {/* Archive contents modal */}
      {archiveContentsPath && (
        <ArchiveContentsModal
          archivePath={archiveContentsPath}
          onClose={() => setArchiveContentsPath(null)}
          onExtract={() => {
            const path = archiveContentsPath;
            setArchiveContentsPath(null);
            setExtractArchivePath(path);
          }}
        />
      )}
    </div>
  );
};

export default ExplorerPage;
