import type { EditorState } from "~/types/ServiceFile";

export interface FileSystemNode {
  id: string; // Unique ID, can be the file path or a generated one
  name: string; // File or folder name
  displayName: string; // Explicit display name (base name)
  path: string; // Full path to the item
  type: "file" | "folder";
  children?: FileSystemNode[];
  modifiedAt?: string;
  // Optional: if we want to link directly to AppFile properties or manage editor state here
  content?: string;
  isDirty?: boolean;
  editorState?: EditorState;
  appFileId?: string; // Original AppFile ID if different from path
}
