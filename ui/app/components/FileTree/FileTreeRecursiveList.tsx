import type { FileSystemNode } from "./types";
import FileNode from "./FileNode";
import { cn } from "~/utils/cn";

interface FileTreeRecursiveListProps {
  nodes: FileSystemNode[];
  onOpenFile: (file: FileSystemNode) => void;
  onDownloadFile: (file: FileSystemNode) => void;
  onDeleteFile: (file: FileSystemNode) => void;
  selectedFileId?: string | null;
  level: number;
}

export function FileTreeRecursiveList({
  nodes,
  onOpenFile,
  onDownloadFile,
  onDeleteFile,
  selectedFileId,
  level,
}: FileTreeRecursiveListProps) {
  if (!nodes || nodes.length === 0) {
    return null;
  }
  return (
    <ul
      className={cn(
        "select-none overflow-hidden text-sm hidden peer-has-[:checked]:block"
      )}
    >
      {nodes.map((node) => (
        <FileNode
          key={node.id}
          node={node}
          onOpenFile={onOpenFile}
          onDownloadFile={onDownloadFile}
          onDeleteFile={onDeleteFile}
          selectedFileId={selectedFileId}
          level={level}
        />
      ))}
    </ul>
  );
}

export default FileTreeRecursiveList;
