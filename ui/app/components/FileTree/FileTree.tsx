import React from "react";
import type { FileSystemNode } from "./types";
import FileNode from "./FileNode";
import { FaPlus } from "react-icons/fa";

interface FileTreeProps {
  nodes: FileSystemNode[];
  onOpenFile: (file: FileSystemNode) => void;
  onDownloadFile: (file: FileSystemNode) => void;
  onDeleteFile: (file: FileSystemNode) => void;
  onAddFile: () => void; // Callback to trigger add file modal/action
  selectedFileId?: string | null;
  isLoading?: boolean;
}

export const FileTree: React.FC<FileTreeProps> = ({
  nodes,
  onOpenFile,
  onDownloadFile,
  onDeleteFile,
  onAddFile,
  selectedFileId,
  isLoading,
}) => {
  return (
    <div className="bg-gray-850 rounded-lg shadow p-4 h-full flex flex-col select-none">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold text-gray-200">Project Files</h2>
        <button
          onClick={onAddFile}
          className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm"
          title="Add a new file or folder"
        >
          <FaPlus size={12} /> Add File
        </button>
      </div>
      {isLoading && (
        <div className="text-gray-400 text-center py-6">Loading tree...</div>
      )}
      {!isLoading && nodes.length === 0 && (
        <div className="text-gray-400 text-center py-6 flex-1 flex items-center justify-center">
          No files or folders found. Click "Add File" to create one.
        </div>
      )}
      {!isLoading && nodes.length > 0 && (
        <div className="flex-1 overflow-y-auto pr-1">
          {/* This outer ul is for the top-level, checkbox is not needed here, it's handled inside FileNode for folders */}
          <ul className="text-sm">
            {nodes.map((node) => (
              <FileNode
                key={node.id}
                node={node}
                onOpenFile={onOpenFile}
                onDownloadFile={onDownloadFile}
                onDeleteFile={onDeleteFile}
                selectedFileId={selectedFileId}
                level={0} // Start at root level
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// Need to import FileNode here because FileTreeRecursiveList might not be the direct parent for root nodes
// import FileNode from './FileNode'; // Commented out or removed from here

export default FileTree;
