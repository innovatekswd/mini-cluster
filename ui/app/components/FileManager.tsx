import React, { useState, useEffect, Suspense, lazy } from "react";
import { FileTabs } from "./FileTabs";
const FileEditor = lazy(() => import("./FileEditor").then(m => ({ default: m.FileEditor })));
// import { fileService } from "~/services/fileService"; // No longer directly used here
import type {
  // AppFile, // No longer directly used here
  OpenFile, // Still needed for activeFile prop type for FileEditor potentially
  // EditorState, // No longer directly used here
  // EditorSession, // No longer directly used here
} from "~/types/ServiceFile";
import {
  FaExpand,
  FaCompress,
  FaSync,
  FaChevronLeft,
  FaChevronRight,
  FaFolder,
} from "react-icons/fa";
import { FileTree } from "./FileTree/FileTree";
import type { FileSystemNode } from "./FileTree/types";
import { NewFileForm } from "./NewFileForm";
import { useFileManagerLogic } from "~/hooks/useFileManagerLogic"; // Import the new hook

// Helper function transformFilesToTree is now in useFileManagerLogic.ts

interface FileManagerProps {
  appId: string;
  visible?: boolean;
}

export const FileManager: React.FC<FileManagerProps> = ({
  appId: initialAppId, // Renamed to avoid conflict with hook's return value if named the same
  visible = true,
}) => {
  const {
    appId, // This is the appId from the hook, should be the same as initialAppId
    allAppFiles,
    openFiles,
    activeFileId,
    loading,
    treeLoading,
    error,
    // sessionLoaded, // Not directly used by UI
    showAddFileModal,
    fileSystemNodes,
    activeFile,
    setActiveFileId,
    // loadFilesAndSession, // Called by hook
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
    // For FileEditor's onOpenFile prop, we might need to adjust how it's passed or handled
    // setAllAppFiles,
    // setOpenFiles,
    // setError: setLogicError, // Renaming to avoid conflict if a local error state is needed
    // setLoading: setLogicLoading // Renaming
  } = useFileManagerLogic({ appId: initialAppId }); // Pass the initialAppId to the hook

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isTreeCollapsed, setIsTreeCollapsed] = useState(false);

  const toggleFullScreen = () => {
    const newFullScreenState = !isFullScreen;
    setIsFullScreen(newFullScreenState);
    
    // Manage body overflow based on the NEW state
    if (newFullScreenState) {
      document.body.style.overflow = 'hidden';
      // Reset any scroll positions when entering fullscreen
      window.scrollTo(0, 0);
    } else {
      document.body.style.overflow = '';
    }
    
    // Force a layout recalculation after the state change
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullScreen) {
        setIsFullScreen(false);
        document.body.style.overflow = '';
        // Force a layout recalculation
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
        }, 50);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFullScreen]);

  // Clean up on unmount or when fullscreen changes
  useEffect(() => {
    return () => {
      // Always restore body overflow when component unmounts
      document.body.style.overflow = '';
    };
  }, []);

  // Additional cleanup for fullscreen state changes
  useEffect(() => {
    // Cleanup function for when fullscreen state changes or component unmounts
    return () => {
      if (isFullScreen) {
        document.body.style.overflow = '';
      }
    };
  }, [isFullScreen]);

  // Toggle tree collapse state
  const toggleTree = () => {
    setIsTreeCollapsed(prev => !prev);
  };

  // When visibility changes, ensure editor layout is updated
  useEffect(() => {
    if (visible && activeFileId) {
      // Short delay to let DOM render
      setTimeout(() => {
        // Find the editor instance and update its layout
        const editor = document.querySelector('.monaco-editor');
        if (editor && (editor as any).getBoundingClientRect) {
          // Force layout recalculation
          const editorApi = editor as any;
          if (editorApi.refresh) {
            editorApi.refresh();
          }
        }
      }, 50);
    }
  }, [visible, activeFileId]);

  return (
    <div
      className={`flex flex-col h-full w-full text-white ${
        isFullScreen ? "fixed inset-0 z-[9999] bg-gray-950" : ""
      }`}
      style={isFullScreen ? { padding: 0, margin: 0, borderRadius: 0 } : {}}
    >
      <div
        className={`flex-none flex items-center justify-between p-2 border-b border-gray-700 ${
          isFullScreen ? "bg-gray-950" : "bg-gray-850"
        }`}
      >
        <div className="text-md font-semibold flex items-center gap-2">
          <button
            onClick={toggleTree}
            className="p-1.5 text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title={isTreeCollapsed ? "Expand File List" : "Collapse File List"}
          >
            {isTreeCollapsed ? <FaChevronRight /> : <FaChevronLeft />}
          </button>
          <span>File Manager</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshAllFiles}
            className="p-1.5 text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title="Refresh File List"
          >
            <FaSync />
          </button>
          {openFiles.length > 0 && (
            <button
              onClick={toggleFullScreen}
              className="p-1.5 text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
              title={
                isFullScreen ? "Exit Editor Fullscreen" : "Editor Fullscreen"
              }
            >
              {isFullScreen ? <FaCompress /> : <FaExpand />}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded m-2">
          Error: {error}
        </div>
      )}

      <div
        className={`flex flex-1 min-h-0 ${
          isFullScreen ? "h-[calc(100vh-0px)]" : ""
        }`}
      >
        {/* Collapsible File Tree Panel */}
        <div
          className={`transition-all duration-300 ease-in-out border-r border-gray-700 bg-gray-900 h-full ${
            isTreeCollapsed
              ? "w-12 min-w-[3rem] max-w-[3rem] flex flex-col items-center justify-start"
              : "w-1/3 min-w-[280px] max-w-[400px]"
          } ${
            isFullScreen
              ? "lg:w-1/4 lg:min-w-[50px] xl:w-1/5 xl:min-w-[50px]"
              : ""
          }`}
        >
          {!isTreeCollapsed ? (
            <FileTree
              nodes={fileSystemNodes}
              onOpenFile={handleOpenFileFromTree}
              onDownloadFile={handleDownloadFileFromTree}
              onDeleteFile={handleDeleteFileFromTree}
              onAddFile={handleAddFile}
              selectedFileId={activeFileId}
              isLoading={treeLoading}
            />
          ) : (
            <button
              className="mt-4 text-gray-400 hover:text-white"
              onClick={toggleTree}
              title="Expand File List"
            >
              <FaFolder size={22} />
            </button>
          )}
        </div>

        {/* Editor Area */}
        <div
          className={`flex-1 flex flex-col min-w-0 h-full bg-gray-850 ${
            isFullScreen ? "" : "rounded-r-lg"
          }`}
        >
          {openFiles.length > 0 ? (
            <>
              <FileTabs
                files={openFiles}
                activeFileId={activeFileId}
                onTabSelect={setActiveFileId}
                onTabClose={handleCloseFile}
              />
              {activeFile && (
                <div className="flex-1 min-h-0">
                  <Suspense fallback={<div className="flex-1 flex items-center justify-center text-gray-500">Loading editor...</div>}>
                    <FileEditor
                      key={activeFile.id}
                      appId={appId}
                      file={activeFile as OpenFile}
                      onSave={handleSaveFile}
                      onClose={() => handleCloseFile(activeFile.id)}
                      onChange={handleFileContentChange}
                      onEditorStateChange={handleEditorStateChange}
                      allFiles={allAppFiles}
                      onOpenFile={(appFileToOpen) => {
                        const nodeToOpen = fileSystemNodes
                          .flatMap((n: FileSystemNode) =>
                            n.type === "folder" && n.children ? n.children : [n]
                          )
                          .find(
                            (fn: FileSystemNode) =>
                              fn.appFileId === appFileToOpen.id
                          );

                        if (nodeToOpen) {
                          handleOpenFileFromTree(nodeToOpen);
                        } else {
                          console.warn(
                            "File not found in current tree, attempting to open directly via AppFile info"
                          );
                          handleOpenFileFromTree({
                            id: appFileToOpen.filePath,
                            name: appFileToOpen.name,
                            displayName: appFileToOpen.name,
                            path: appFileToOpen.filePath,
                            type: "file",
                            appFileId: appFileToOpen.id,
                          });
                        }
                      }}
                      disableFullScreen={true}
                      isFullScreen={isFullScreen}
                    />
                  </Suspense>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 p-4">
              {treeLoading || loading
                ? "Loading..."
                : allAppFiles.length > 0
                ? "Select a file from the tree to open."
                : "No files in this project. Click 'Add File' in the tree."}
            </div>
          )}
        </div>
      </div>

      {showAddFileModal && (
        <NewFileForm
          appId={appId}
          onClose={closeAddFileModal}
          onFileAdded={() => {
            closeAddFileModal();
            refreshAllFiles();
          }}
        />
      )}
    </div>
  );
};
