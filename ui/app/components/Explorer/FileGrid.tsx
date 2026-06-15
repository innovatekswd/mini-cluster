import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GridRoot, midnightTheme } from '@hivemind/grid';
import type { GridColumnDef, GridRow, GridSelectionEvent, GridFilters } from '@hivemind/grid';
import {
  FaFolder, FaFile, FaImage, FaFileAlt, FaFilePdf, FaFileArchive,
  FaFileCode, FaFileAudio, FaFileVideo, FaDatabase, FaCog,
  FaFileExcel, FaFileWord, FaFilePowerpoint, FaKey,
} from 'react-icons/fa';
import {
  type DirectoryListing, type FileItem,
  formatFileSize, formatDate,
} from '~/services/explorerService';

// ── Theme ─────────────────────────────────────────────────────────────────────

const GRID_THEME = {
  ...midnightTheme,
  bgBase:          '#020617',
  bgAlt:           '#030712',
  bgHeader:        '#0f172a',
  bgFilterRow:     '#080f1e',
  bgSelection:     '#0e3a52',
  border:          '#1e293b',
  borderStrong:    '#2d3f55',
  accent:          '#22d3ee',
  colorText:       '#e2e8f0',
  colorTextMuted:  '#64748b',
  colorTextHeader: '#94a3b8',
  headerH:         34,
  filterH:         30,
  fontSizeBase:    12,
  fontSizeSmall:   11,
};

// ── File type icons ───────────────────────────────────────────────────────────

interface IconDef { icon: React.ReactNode; color: string }

function getFileIconDef(item: FileItem): IconDef {
  if (item.type === 'directory') return { icon: <FaFolder />, color: '#f59e0b' };
  const ext = item.extension?.replace(/^\./, '').toLowerCase() ?? '';

  if (['jpg','jpeg','png','gif','bmp','svg','webp','ico','tiff','avif','heic','raw'].includes(ext))
    return { icon: <FaImage />, color: '#a78bfa' };
  if (ext === 'pdf')
    return { icon: <FaFilePdf />, color: '#f87171' };
  if (['zip','gz','tar','bz2','xz','7z','rar','tgz','zst','lz4','br','cab','iso'].includes(ext))
    return { icon: <FaFileArchive />, color: '#fb923c' };
  if (['mp3','wav','flac','aac','ogg','m4a','opus','wma','aiff'].includes(ext))
    return { icon: <FaFileAudio />, color: '#34d399' };
  if (['mp4','mkv','avi','mov','webm','flv','wmv','m4v','ts','vob'].includes(ext))
    return { icon: <FaFileVideo />, color: '#60a5fa' };
  if (['xlsx','xls','csv','ods','tsv'].includes(ext))   return { icon: <FaFileExcel />,      color: '#4ade80' };
  if (['doc','docx','odt','rtf'].includes(ext))          return { icon: <FaFileWord />,       color: '#60a5fa' };
  if (['ppt','pptx','odp'].includes(ext))                return { icon: <FaFilePowerpoint />, color: '#f97316' };
  if (['js','ts','jsx','tsx','py','go','rs','c','cpp','h','hpp','java','kt','swift',
       'rb','php','cs','html','htm','xml','css','scss','sass','less','json','yaml',
       'yml','toml','vue','svelte','dart','lua','r','sh','bash','zsh','fish','ps1',
       'bat','cmd'].includes(ext))
    return { icon: <FaFileCode />, color: '#22d3ee' };
  if (['exe','bin','elf','deb','rpm','appimage','dmg','msi','so','dll'].includes(ext))
    return { icon: <FaCog />, color: '#94a3b8' };
  if (['db','sqlite','sqlite3','sql','mdb','accdb'].includes(ext))
    return { icon: <FaDatabase />, color: '#fbbf24' };
  if (['pem','crt','cer','key','p12','pfx','asc','gpg','pub'].includes(ext))
    return { icon: <FaKey />, color: '#f472b6' };
  if (['txt','md','rst','log','conf','cfg','env','ini'].includes(ext))
    return { icon: <FaFileAlt />, color: '#94a3b8' };
  return { icon: <FaFile />, color: '#64748b' };
}

// ── Row conversion ────────────────────────────────────────────────────────────
// IMPORTANT: field names must exactly match column `key` values so that
// GridRoot's internal sort and column-filter logic (getField) can read them.

function itemToRow(item: FileItem): GridRow {
  return {
    id:       item.path,
    name:     item.name,
    // display string — filter 'contains' matches what the user sees
    size:     item.type === 'file'
      ? formatFileSize(item.size ?? 0)
      : (item.itemCount != null ? `${item.itemCount} items` : '—'),
    // formatted date — filter 'contains "Jun"' works
    modified: item.modified ? formatDate(item.modified) : '—',
    // extension without dot, lowercase
    ext:      item.type === 'directory' ? 'folder' : (item.extension?.replace(/^\./, '').toLowerCase() ?? ''),
    // raw values for sorting — prefixed _ so no column key matches them
    _sizeBytes: item.type === 'file' ? (item.size ?? 0) : -1,
    _modifiedMs: item.modified ? new Date(item.modified).getTime() : 0,
    // NOT used by any column key — only by render fns
    _item:    item,
  };
}

// ── Columns ───────────────────────────────────────────────────────────────────

const COLUMNS: GridColumnDef[] = [
  {
    key: 'name',
    header: 'Name',
    width: 300,
    minWidth: 120,
    type: 'text',
    filterable: true,
    render: (row) => {
      const item = (row as any)._item as FileItem;
      const { icon, color } = getFileIconDef(item);
      return (
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden' }}>
          <span style={{ color, flexShrink: 0, fontSize: 13, display: 'flex' }}>{icon}</span>
          <span style={{
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontWeight: item.type === 'directory' ? 600 : 400,
          }}>
            {item.name}
          </span>
          {item.isHidden && (
            <span style={{ fontSize: 10, color: '#475569', flexShrink: 0 }}>hidden</span>
          )}
        </span>
      );
    },
  },
  {
    key: 'size',
    header: 'Size',
    width: 90,
    minWidth: 60,
    type: 'text',   // display string → filter 'contains "KB"' works; sort handled via _sizeBytes
    filterable: true,
    render: (row) => {
      const item = (row as any)._item as FileItem;
      if (!item) return null;
      const isDir = item.type === 'directory';
      return (
        <span style={{ fontFamily: 'monospace', color: isDir ? '#475569' : undefined, textAlign: 'right', display: 'block' }}>
          {row.size as string}
        </span>
      );
    },
  },
  {
    key: 'ext',
    header: 'Type',
    width: 72,
    minWidth: 50,
    type: 'text',
    filterable: true,
    render: (row) => {
      const item = (row as any)._item as FileItem;
      if (!item || item.type === 'directory')
        return <span style={{ color: '#f59e0b', fontSize: 11 }}>Folder</span>;
      const e = item.extension?.replace(/^\./, '').toUpperCase() || 'File';
      return <span style={{ color: '#94a3b8', fontSize: 11 }}>{e}</span>;
    },
  },
  {
    key: 'modified',
    header: 'Modified',
    width: 150,
    minWidth: 90,
    type: 'text',   // formatted date → filter 'contains "Jun"' works; sort via _modifiedMs
    filterable: true,
    render: (row) => (
      <span style={{ color: '#64748b' }}>{row.modified as string}</span>
    ),
  },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface FileGridProps {
  listing: DirectoryListing | null;
  loading: boolean;
  selectedItems: Set<string>;
  searchQuery?: string;
  clipboard: { items: string[]; action: 'copy' | 'cut' } | null;
  onOpen: (item: FileItem) => void;
  onContextMenu: (e: React.MouseEvent, item: FileItem) => void;
  onSelectionChange: (paths: string[]) => void;
  onCompress: (paths: string[]) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const FileGrid: React.FC<FileGridProps> = ({
  searchQuery = '',
  listing,
  loading,
  selectedItems,
  clipboard,
  onOpen,
  onContextMenu,
  onSelectionChange,
  onCompress,
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [gridH, setGridH] = useState(400);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [filters, setFilters] = useState<GridFilters>({});

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setGridH(Math.max(100, e.contentRect.height - 36)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rows = useMemo<GridRow[]>(() => {
    if (!listing?.items) return [];

    // Helper to check if a filter is active
    const isActiveFilter = (f: any): boolean => {
      if (!f) return false;
      if (f.op === 'empty' || f.op === 'not_empty') return true;
      if (f.value == null || f.value === '') return false;
      return true;
    };

    // Check if any column filter is active
    const hasColumnFilters = Object.values(filters).some(isActiveFilter);

    // Apply column filters (client-side)
    let filteredItems = listing.items;
    if (hasColumnFilters) {
      filteredItems = filteredItems.filter(item => {
        const row = itemToRow(item);
        for (const [key, filterSpec] of Object.entries(filters)) {
          if (!isActiveFilter(filterSpec)) continue;
          const cellVal = row[key];
          const { op, value } = filterSpec!;
          
          // Handle different operators
          if (op === 'contains') {
            const needle = String(value ?? '').toLowerCase();
            const haystack = String(cellVal ?? '').toLowerCase();
            if (!haystack.includes(needle)) return false;
          } else if (op === 'not_contains') {
            const needle = String(value ?? '').toLowerCase();
            const haystack = String(cellVal ?? '').toLowerCase();
            if (haystack.includes(needle)) return false;
          } else if (op === 'eq') {
            if (String(cellVal ?? '').toLowerCase() !== String(value ?? '').toLowerCase()) return false;
          } else if (op === 'starts_with') {
            const needle = String(value ?? '').toLowerCase();
            const haystack = String(cellVal ?? '').toLowerCase();
            if (!haystack.startsWith(needle)) return false;
          } else if (op === 'ends_with') {
            const needle = String(value ?? '').toLowerCase();
            const haystack = String(cellVal ?? '').toLowerCase();
            if (!haystack.endsWith(needle)) return false;
          } else if (op === 'empty') {
            if (cellVal != null && String(cellVal).trim() !== '') return false;
          } else if (op === 'not_empty') {
            if (cellVal == null || String(cellVal).trim() === '') return false;
          }
        }
        return true;
      });
    }

    // Apply global search query (client-side)
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      filteredItems = filteredItems.filter(i =>
        i.name.toLowerCase().includes(q) ||
        (i.extension ?? '').toLowerCase().includes(q) ||
        i.path.toLowerCase().includes(q) ||
        i.type.toLowerCase().includes(q)
      );
    }

    const folders = filteredItems.filter(i => i.type === 'directory');
    const files   = filteredItems.filter(i => i.type === 'file');
    let items = [...folders, ...files].map(itemToRow);

    if (sort) {
      const d = sort.dir === 'asc' ? 1 : -1;
      items = items.sort((a, b) => {
        const ai = (a as any)._item as FileItem;
        const bi = (b as any)._item as FileItem;
        // folders always first
        if (ai.type !== bi.type) return ai.type === 'directory' ? -1 : 1;
        // numeric sort for size/modified using raw values
        if (sort.key === 'size')
          return (((a as any)._sizeBytes ?? 0) - ((b as any)._sizeBytes ?? 0)) * d;
        if (sort.key === 'modified')
          return (((a as any)._modifiedMs ?? 0) - ((b as any)._modifiedMs ?? 0)) * d;
        // text sort for name/ext
        return String(a[sort.key] ?? '').localeCompare(String(b[sort.key] ?? '')) * d;
      });
    }
    return items;
  }, [listing, sort, searchQuery, filters]);

  const selectedIds = useMemo(() => Array.from(selectedItems), [selectedItems]);

  const handleSelectionChange = useCallback((evt: GridSelectionEvent) => {
    onSelectionChange(evt.selectedIds ?? []);
  }, [onSelectionChange]);

  const handleRowDoubleClick = useCallback((row: GridRow) => {
    const item = (row as any)._item as FileItem;
    if (item) onOpen(item);
  }, [onOpen]);

  const handleContextMenu = useCallback((evt: {
    row: GridRow; x: number; y: number; nativeEvent?: MouseEvent
  }) => {
    const item = (evt.row as any)?._item as FileItem | undefined;
    if (item && evt.nativeEvent) {
      onContextMenu(evt.nativeEvent as unknown as React.MouseEvent, item);
    }
  }, [onContextMenu]);

  const totalSelected = selectedItems.size;
  const inClipboard   = clipboard ? clipboard.items.length : 0;

  return (
    <div ref={wrapRef} className="flex-1 flex flex-col min-h-0 h-full">
      <div className="flex-1 min-h-0">
        <GridRoot
          rows={rows}
          columns={COLUMNS}
          containerHeight={gridH}
          rowHeight={32}
          enableMultiSelect
          enableSort
          showFilters
          enableColumnResize
          renderMode="virtual"
          loading={loading}
          selectedIds={selectedIds}
          onSelectionChange={handleSelectionChange}
          onRowDoubleClick={handleRowDoubleClick}
          onRowContextMenu={handleContextMenu}
          sort={sort ?? undefined}
          onSortChange={(s) => setSort(s ? { key: s.key, dir: s.dir ?? 'asc' } : null)}
          onFiltersChange={setFilters}
          theme={GRID_THEME}
          style={{ height: '100%', width: '100%', border: 'none', borderRadius: 0 }}
        />
      </div>

      {/* Status bar */}
      <div className="flex-none h-9 px-4 border-t border-slate-800 text-xs text-slate-500 flex items-center justify-between">
        <span>
          {listing ? `${listing.totalItems} items` : ''}
          {totalSelected > 0 && ` · ${totalSelected} selected`}
        </span>
        <div className="flex items-center gap-3">
          {totalSelected > 0 && (
            <button
              onClick={() => onCompress(Array.from(selectedItems))}
              className="text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Compress
            </button>
          )}
          {clipboard && (
            <span className="flex items-center gap-2 text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              {inClipboard} {clipboard.action === 'copy' ? 'copied' : 'cut'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileGrid;
