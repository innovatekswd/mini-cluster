export interface AppFile {
  id: string;
  appId: string;
  name: string;
  filePath: string;
  createdAt: string;
  modifiedAt: string;
}

export interface AppFileContent {
  content: string;
  encoding: 'utf8' | 'base64';
}

export interface CreateAppFileDto {
  name: string;
  filePath: string;
}

export interface UpdateAppFileDto {
  name?: string;
  content?: string;
}

export interface EditorSession {
  appId: string;
  openFiles: string[]; // Array of file IDs
  activeFileId: string | null;
  fileStates: Record<string, EditorState>;
  timestamp: number;
}

export interface EditorState {
  cursor?: {
    line: number;
    column: number;
  };
  scroll?: {
    top: number;
    left: number;
  };
  selection?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  folds?: Array<{ start: number; end: number }>;
  viewState?: any; // Monaco editor-specific view state
}

export interface OpenFile extends AppFile {
  content: string;
  isDirty: boolean;
  editorState: EditorState;
}

