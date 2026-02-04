import { useState, useEffect, useCallback, useMemo } from "react";
import { fileService } from "~/services/fileService";
import type {
  AppFile,
  OpenFile,
  EditorState,
  EditorSession,
} from "~/types/ServiceFile";
import type { FileSystemNode } from "~/components/FileTree/types"; // Adjusted path

// Helper function to transform flat AppFile list to hierarchical FileSystemNode[]
const transformFilesToTree = (files: AppFile[]): FileSystemNode[] => {
  const tree: FileSystemNode[] = [];
  const map: Record<string, FileSystemNode> = {};

  // Filter out files with undefined filePath and sort
  const sortedFiles = [...files]
    .filter((f) => f.filePath)
    .sort((a, b) => a.filePath.localeCompare(b.filePath));

  sortedFiles.forEach((file) => {
    const parts = file.filePath.split("/").filter((p) => p);
    let currentPath = "";

    parts.forEach((part, index) => {
      const isLastPart = index === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      let node = map[currentPath];

      if (!node) {
        node = {
          id: currentPath,
          name: part,
          displayName: part,
          path: currentPath,
          type: isLastPart ? "file" : "folder",
          children: isLastPart ? undefined : [],
          modifiedAt: isLastPart ? file.modifiedAt : undefined,
          appFileId: isLastPart ? file.id : undefined,
        };
        map[currentPath] = node;

        if (index === 0) {
          tree.push(node);
        } else {
          const parentPath = parts.slice(0, index).join("/");
          const parentNode = map[parentPath];
          if (
            parentNode &&
            parentNode.type === "folder" &&
            parentNode.children
          ) {
            parentNode.children.push(node);
          }
        }
      } else {
        if (isLastPart && node.type === "folder") {
          node.type = "file";
          node.modifiedAt = file.modifiedAt;
          node.appFileId = file.id;
        }
      }
      if (node.type === "folder" && node.children && !isLastPart) {
        // Ensure we are traversing down the correct children array
        // This logic might need refinement depending on how map and currentLevel were used previously.
        // For now, we rely on the map to find the correct parent later.
      }
    });
  });

  const sortNodes = (nodes: FileSystemNode[]) => {
    nodes.sort((a, b) => {
      if (a.type === "folder" && b.type === "file") return -1;
      if (a.type === "file" && b.type === "folder") return 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((node) => {
      if (node.children) sortNodes(node.children);
    });
  };
  sortNodes(tree);
  return tree;
};

interface UseFileManagerLogicProps {
  appId: string;
}

export const useFileManagerLogic = ({ appId }: UseFileManagerLogicProps) => {
  const [allAppFiles, setAllAppFiles] = useState<AppFile[]>([]);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [treeLoading, setTreeLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [showAddFileModal, setShowAddFileModal] = useState(false);

  const fileSystemNodes = useMemo(
    () => transformFilesToTree(allAppFiles),
    [allAppFiles]
  );

  const loadFilesAndSession = useCallback(async () => {
    try {
      setLoading(true);
      setTreeLoading(true);
      setError(null);

      const fileList = await fileService.getFiles(appId);
      setAllAppFiles(fileList);
      setTreeLoading(false);

      const session = fileService.loadEditorSession(appId);
      let filesToOpenFromSession: OpenFile[] = [];
      let sessionActiveFileId: string | null = null;

      if (session && session.openFiles.length > 0) {
        sessionActiveFileId = session.activeFileId; // Store session's active ID
        const currentOpenFilesMap = new Map(openFiles.map((f) => [f.id, f]));

        const openFilePromises = session.openFiles.map(
          async (fileAppFileId) => {
            const existingOpenFile = currentOpenFilesMap.get(fileAppFileId);
            const fileDetailFromList = fileList.find(
              (f) => f.id === fileAppFileId
            );

            if (!fileDetailFromList) return null;

            if (existingOpenFile) {
              return {
                ...existingOpenFile,
                name: fileDetailFromList.name,
                filePath: fileDetailFromList.filePath,
                path: fileDetailFromList.filePath,
                modifiedAt: fileDetailFromList.modifiedAt,
              };
            } else {
              try {
                const contentResponse = await fileService.getFileContent(
                  appId,
                  fileAppFileId
                );
                return {
                  ...fileDetailFromList,
                  content: contentResponse.content,
                  isDirty: false,
                  editorState: session.fileStates[fileAppFileId] || {},
                } as OpenFile;
              } catch (err) {
                console.error(
                  `Failed to load content for file ${fileAppFileId}:`,
                  err
                );
                return null;
              }
            }
          }
        );
        filesToOpenFromSession = (await Promise.all(openFilePromises)).filter(
          Boolean
        ) as OpenFile[];
      }

      setOpenFiles(filesToOpenFromSession);

      if (filesToOpenFromSession.length > 0) {
        const activeFileStillPresent =
          sessionActiveFileId && // Use stored sessionActiveFileId
          filesToOpenFromSession.find((f) => f.id === sessionActiveFileId);

        setActiveFileId(
          activeFileStillPresent
            ? sessionActiveFileId // Use stored sessionActiveFileId
            : filesToOpenFromSession[0].id
        );
      } else {
        setActiveFileId(null);
      }

      setSessionLoaded(true);
    } catch (err) {
      console.error("Failed to load files and session:", err);
      setError("Failed to load files and session. Please try again.");
      setTreeLoading(false);
    } finally {
      setLoading(false);
    }
  }, [appId, openFiles]);

  useEffect(() => {
    loadFilesAndSession();
  }, [appId]);

  // Save editor session (open tabs, active tab, editor states)
  useEffect(() => {
    if (!sessionLoaded) return;
    const validOpenFiles = openFiles.filter((of) =>
      allAppFiles.some((af) => af.id === of.id)
    );

    if (validOpenFiles.length === 0 && !activeFileId) {
      fileService.clearEditorSession(appId);
      return;
    }

    const activeIdToSave =
      activeFileId && validOpenFiles.some((f) => f.id === activeFileId)
        ? activeFileId
        : validOpenFiles.length > 0
        ? validOpenFiles[0].id
        : null;

    const sessionToSave: EditorSession = {
      appId,
      openFiles: validOpenFiles.map((file) => file.id),
      activeFileId: activeIdToSave,
      fileStates: validOpenFiles.reduce((acc, file) => {
        acc[file.id] = file.editorState || {};
        return acc;
      }, {} as Record<string, EditorState>),
      timestamp: Date.now(),
    };
    fileService.saveEditorSession(sessionToSave);
  }, [openFiles, activeFileId, appId, sessionLoaded, allAppFiles]);

  const refreshAllFiles = useCallback(async () => {
    try {
      setTreeLoading(true);
      setError(null);
      const fileList = await fileService.getFiles(appId);
      setAllAppFiles(fileList);

      setOpenFiles(
        (prevOpenFiles) =>
          prevOpenFiles
            .map((currentOpenFile) => {
              const updatedFileDetail = fileList.find(
                (f) => f.id === currentOpenFile.id
              );
              if (updatedFileDetail) {
                return {
                  ...currentOpenFile,
                  name: updatedFileDetail.name,
                  filePath: updatedFileDetail.filePath,
                  path: updatedFileDetail.filePath,
                  modifiedAt: updatedFileDetail.modifiedAt,
                };
              }
              return null;
            })
            .filter(Boolean) as OpenFile[]
      );
    } catch (err) {
      console.error("Failed to refresh files:", err);
      setError("Failed to refresh file list");
    } finally {
      setTreeLoading(false);
    }
  }, [appId]);

  const handleOpenFileFromTree = useCallback(
    async (node: FileSystemNode) => {
      if (node.type === "folder" || !node.appFileId) return;

      const existingOpenFile = openFiles.find((f) => f.id === node.appFileId);
      if (existingOpenFile) {
        setActiveFileId(node.appFileId);
        return;
      }

      try {
        setLoading(true);
        const appFile = allAppFiles.find((f) => f.id === node.appFileId);
        if (!appFile) {
          setError(`File details not found for ${node.name}`);
          setLoading(false);
          return;
        }
        const contentResponse = await fileService.getFileContent(
          appId,
          node.appFileId
        );
        const newOpenFile: OpenFile = {
          ...appFile,
          content: contentResponse.content,
          isDirty: false,
          editorState: {},
        };
        setOpenFiles((prev) => [...prev, newOpenFile]);
        setActiveFileId(node.appFileId);
      } catch (err) {
        console.error("Failed to open file:", err);
        setError(`Failed to open ${node.name}`);
      } finally {
        setLoading(false);
      }
    },
    [appId, openFiles, allAppFiles]
  );

  const handleSaveFile = async () => {
    if (!activeFileId) return;
    const fileToSave = openFiles.find((f) => f.id === activeFileId);
    if (!fileToSave || !fileToSave.isDirty) {
      return;
    }

    try {
      setLoading(true);
      await fileService.updateFile(appId, fileToSave.id, {
        content: fileToSave.content,
      });
      const newModifiedAt = new Date().toISOString();

      setOpenFiles((prev) =>
        prev.map((f) =>
          f.id === activeFileId
            ? {
                ...f,
                content: fileToSave.content,
                isDirty: false,
                modifiedAt: newModifiedAt,
              }
            : f
        )
      );
      setAllAppFiles((prev) =>
        prev.map((f) =>
          f.id === activeFileId
            ? { ...f, modifiedAt: newModifiedAt, content: fileToSave.content }
            : f
        )
      );
    } catch (err) {
      console.error("Failed to save file:", err);
      setError(`Failed to save ${fileToSave.name}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseFile = (fileAppFileId: string) => {
    const fileToClose = openFiles.find((f) => f.id === fileAppFileId);
    if (
      fileToClose?.isDirty &&
      !confirm("You have unsaved changes. Close anyway?")
    ) {
      return;
    }

    const sessionKey = `editor-content-${appId}-${fileAppFileId}`;
    // Optional: Decide if we want to clear session storage on explicit close
    // For now, we don't, to allow reopening with edits.
    // sessionStorage.removeItem(sessionKey);

    setOpenFiles((prev) => prev.filter((f) => f.id !== fileAppFileId));
    if (activeFileId === fileAppFileId) {
      const remainingFiles = openFiles.filter((f) => f.id !== fileAppFileId);
      setActiveFileId(remainingFiles.length > 0 ? remainingFiles[0].id : null);
    }
  };

  const handleFileContentChange = (
    fileAppFileId: string,
    newContent: string,
    isDirtyFromEditor: boolean
  ) => {
    setOpenFiles((prev) =>
      prev.map((f) =>
        f.id === fileAppFileId
          ? { ...f, content: newContent, isDirty: isDirtyFromEditor }
          : f
      )
    );
  };

  const handleEditorStateChange = (
    fileAppFileId: string,
    editorState: EditorState
  ) => {
    setOpenFiles((prev) =>
      prev.map((f) =>
        f.id === fileAppFileId
          ? { ...f, editorState: { ...f.editorState, ...editorState } }
          : f
      )
    );
  };

  const handleDownloadFileFromTree = async (node: FileSystemNode) => {
    if (node.type === "folder" || !node.appFileId) return;
    try {
      setLoading(true);
      const openFile = openFiles.find((f) => f.id === node.appFileId);
      let contentToDownload: string;
      let fileName = node.name;

      if (openFile && openFile.isDirty) {
        if (
          confirm(
            `"${node.name}" has unsaved changes. Download the unsaved version?`
          )
        ) {
          contentToDownload = openFile.content;
        } else {
          const fileContent = await fileService.getFileContent(
            appId,
            node.appFileId
          );
          contentToDownload = fileContent.content;
        }
      } else {
        const fileContent = await fileService.getFileContent(
          appId,
          node.appFileId
        );
        contentToDownload = fileContent.content;
      }

      const blob = new Blob([contentToDownload], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Failed to download file:", err);
      alert("Failed to download file");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFileFromTree = async (node: FileSystemNode) => {
    if (node.type === "folder" || !node.appFileId) {
      alert("Folder deletion is not implemented yet.");
      return;
    }
    if (!confirm(`Are you sure you want to delete "${node.name}"?`)) return;

    try {
      setLoading(true);
      await fileService.deleteFile(appId, node.appFileId);

      const sessionKey = `editor-content-${appId}-${node.appFileId}`;
      sessionStorage.removeItem(sessionKey);

      const newOpenFiles = openFiles.filter((f) => f.id !== node.appFileId);
      setOpenFiles(newOpenFiles);
      if (activeFileId === node.appFileId) {
        setActiveFileId(newOpenFiles.length > 0 ? newOpenFiles[0].id : null);
      }
      const updatedAllAppFiles = allAppFiles.filter(
        (f) => f.id !== node.appFileId
      );
      setAllAppFiles(updatedAllAppFiles);
    } catch (err) {
      console.error("Failed to delete file:", err);
      alert("Failed to delete file");
    } finally {
      setLoading(false);
    }
  };

  const handleAddFile = () => {
    setShowAddFileModal(true);
  };

  const closeAddFileModal = () => {
    setShowAddFileModal(false);
  };

  const activeFile = useMemo(
    () => openFiles.find((f) => f.id === activeFileId),
    [openFiles, activeFileId]
  );

  return {
    appId,
    allAppFiles,
    openFiles,
    activeFileId,
    loading,
    treeLoading,
    error,
    showAddFileModal,
    fileSystemNodes,
    activeFile,
    setActiveFileId,
    refreshAllFiles,
    handleOpenFileFromTree,
    handleSaveFile,
    handleCloseFile,
    handleFileContentChange,
    handleEditorStateChange,
    handleDownloadFileFromTree,
    handleDeleteFileFromTree,
    handleAddFile,
    closeAddFileModal,
  };
};
