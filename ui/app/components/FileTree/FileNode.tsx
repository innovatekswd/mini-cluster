import { memo } from "react";
import {
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  Edit3Icon,
  DownloadIcon,
  Trash2Icon,
} from "lucide-react";
import type { FileSystemNode } from "./types";
import FileTreeRecursiveList from "./FileTreeRecursiveList"; // Removed .tsx extension

interface FileNodeProps {
  node: FileSystemNode;
  onOpenFile: (file: FileSystemNode) => void;
  onDownloadFile: (file: FileSystemNode) => void;
  onDeleteFile: (file: FileSystemNode) => void;
  selectedFileId?: string | null;
  level: number; // For indentation
}

export const FileNode = memo(function FileNode({
  node,
  onOpenFile,
  onDownloadFile,
  onDeleteFile,
  selectedFileId,
  level,
}: FileNodeProps) {
  const nodeId = node.id;
  const paddingLeft = `${level * 1.5}rem`; // 1.5rem per level

  if (node.type === "folder") {
    return (
      <li
        className="relative before:absolute before:top-9 before:bottom-3 before:left-[calc(var(--padding-left)_+_0.625rem)] before:w-px before:bg-gray-700 last:before:bottom-[calc(1.125rem_+_1px)]"
        style={{ "--padding-left": paddingLeft } as React.CSSProperties}
      >
        <label
          htmlFor={nodeId}
          className="peer group flex items-center gap-2 pr-3 py-2 rounded hover:bg-gray-800 cursor-pointer"
          style={{ paddingLeft }}
          title={node.path} // Path on label hover
        >
          <input
            defaultChecked={level === 0} // Open root level by default, or manage state
            type="checkbox"
            name={nodeId}
            id={nodeId}
            className="hidden"
          />
          <FolderIcon className="size-4 text-sky-500 group-has-[:checked]:hidden flex-shrink-0" />
          <FolderOpenIcon className="size-4 text-sky-500 hidden group-has-[:checked]:inline-block flex-shrink-0" />

          <span
            className="text-gray-300 group-hover:text-white truncate"
            title={node.path} // Path on name hover for tooltip
          >
            {node.displayName}
          </span>
        </label>
        {node.children && node.children.length > 0 && (
          <FileTreeRecursiveList
            nodes={node.children}
            onOpenFile={onOpenFile}
            onDownloadFile={onDownloadFile}
            onDeleteFile={onDeleteFile}
            selectedFileId={selectedFileId}
            level={level + 1}
          />
        )}
      </li>
    );
  }

  // File type
  const isSelected = node.appFileId === selectedFileId;
  return (
    <li className="relative" style={{ paddingLeft }}>
      <div
        className={`flex items-center gap-2 pr-3 py-2 rounded group hover:bg-gray-800/70 ${
          isSelected ? "bg-gray-700" : ""
        }`}
        title={node.path} // Path on row hover
      >
        <FileIcon className="size-4 text-gray-400 flex-shrink-0 ml-1" />
        <span
          className={`text-gray-300 group-hover:text-white truncate flex-1 cursor-pointer ${
            isSelected ? "text-blue-300 font-medium" : ""
          }`}
          title={node.path} // Path on name hover for tooltip
          onClick={() => onOpenFile(node)}
        >
          {node.displayName}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenFile(node);
            }}
            title="Edit File"
            className="p-1 text-gray-400 hover:text-blue-400 rounded"
          >
            <Edit3Icon size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownloadFile(node);
            }}
            title={`Download ${node.name}`}
            className="p-1 text-gray-400 hover:text-green-400 rounded"
          >
            <DownloadIcon size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteFile(node);
            }}
            title={`Delete ${node.name}`}
            className="p-1 text-gray-400 hover:text-red-400 rounded"
          >
            <Trash2Icon size={14} />
          </button>
        </div>
      </div>
    </li>
  );
});

export default FileNode;
