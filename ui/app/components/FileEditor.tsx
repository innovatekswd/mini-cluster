import React, { useRef, useState, useEffect, useCallback } from "react";
import Editor from "@monaco-editor/react";
import {
  FaSave,
  FaTimes,
  FaCircle,
  FaExpand,
  FaCompress,
  FaLightbulb,
  FaFile,
} from "react-icons/fa";
import type { AppFile, EditorState, OpenFile } from "~/types/ServiceFile";
import { fileService } from "~/services/fileService";
import { useIsVisible } from "~/hooks/useIsVisible";
import { useSessionStorage } from "usehooks-ts";
import { useHotkeys } from "react-hotkeys-hook";

interface FileEditorProps {
  appId: string;
  file: OpenFile;
  onSave: () => void;
  onClose: () => void;
  onChange: (fileId: string, content: string, isDirty: boolean) => void;
  onEditorStateChange: (fileId: string, state: EditorState) => void;
  isFullScreen?: boolean;
  allFiles?: AppFile[];
  onOpenFile?: (file: AppFile) => void;
  disableFullScreen?: boolean;
}

// Helper to determine language based on file path
const getLanguageFromPath = (filePath: string): string => {
  const extension = filePath.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "js":
      return "javascript";
    case "ts":
      return "typescript";
    case "jsx":
      return "javascript";
    case "tsx":
      return "typescript";
    case "json":
      return "json";
    case "xml":
      return "xml";
    case "html":
      return "html";
    case "css":
      return "css";
    case "md":
      return "markdown";
    case "py":
      return "python";
    case "cs":
      return "csharp";
    case "yml":
    case "yaml":
      return "yaml";
    case "sql":
      return "sql";
    case "txt":
      return "plaintext";
    default:
      return "plaintext";
  }
};

export const FileEditor: React.FC<FileEditorProps> = ({
  appId,
  file,
  onSave,
  onClose,
  onChange,
  onEditorStateChange,
  isFullScreen = false,
  allFiles = [],
  onOpenFile,
  disableFullScreen = false,
}) => {
  // State management
  const editorRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [editorHeight, setEditorHeight] = useState("100%");
  const [editorWidth, setEditorWidth] = useState("100%");
  const [showFilesList, setShowFilesList] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [viewportSize, setViewportSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  });

  // Check if element is visible in DOM
  const isVisible = useIsVisible(containerRef as React.RefObject<HTMLElement>);

  // Update viewport size on window resize
  useEffect(() => {
    const handleResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
      updateEditorDimensions();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isFullScreen, showFilesList, showTips]);

  // Function to update editor dimensions based on current state
  const updateEditorDimensions = () => {
    if (isFullScreen) {
      const headerHeight = 44; // Header height
      const fileListHeight = showFilesList ? 300 : 0;
      const tipsHeight = showTips ? 120 : 0;
      const totalOffset = headerHeight + fileListHeight + tipsHeight;
      setEditorHeight(`calc(100vh - ${totalOffset}px)`);
      setEditorWidth("100vw");
    } else {
      setEditorHeight("100%");
      setEditorWidth("100%");
    }
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.layout();
      }
    }, 10);
  };

  // Update dimensions when fullscreen state changes
  useEffect(() => {
    if (isFullScreen) {
      document.body.style.overflow = "hidden";
      if (localStorage.getItem("editor-tips-shown") !== "true") {
        setShowTips(true);
        localStorage.setItem("editor-tips-shown", "true");
      }
    } else {
      document.body.style.overflow = "";
      setShowFilesList(false);
      setShowTips(false);
    }
    updateEditorDimensions();
  }, [isFullScreen, showFilesList, showTips]);

  const sessionKey = `editor-content-${appId}-${file.id}`;
  const [editorContent, setEditorContent, removeEditorContent] =
    useSessionStorage(sessionKey, file.content);

  // Update session storage if initial file.content changes (e.g. after a save from another tab)
  useEffect(() => {
    if (file.content !== editorContent && !file.isDirty) {
      // Only if not dirty to prevent overwriting unsaved changes
      setEditorContent(file.content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.content, sessionKey]); // Add sessionKey to deps if it can change, though unlikely for a given file editor instance

  const currentContentRef = useRef(editorContent);
  useEffect(() => {
    currentContentRef.current = editorContent;
  }, [editorContent]);

  // Save handler
  const handleSave = async () => {
    onChange(file.id, file.content, false); // Mark as not dirty
    onSave();
  };

  // Toggle file list visibility
  const toggleFilesView = () => {
    setShowFilesList(!showFilesList);

    // Update editor dimensions after toggle
    setTimeout(() => updateEditorDimensions(), 10);
  };

  // Toggle tips visibility
  const toggleTips = () => {
    setShowTips(!showTips);

    // Update editor dimensions after toggle
    setTimeout(() => updateEditorDimensions(), 10);
  };

  // Set up editor when mounted
  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    // Restore editor state if available
    if (file.editorState) {
      if (file.editorState.cursor) {
        editor.setPosition({
          lineNumber: file.editorState.cursor.line,
          column: file.editorState.cursor.column,
        });
      }
      if (file.editorState.scroll) {
        editor.setScrollPosition({
          scrollTop: file.editorState.scroll.top,
          scrollLeft: file.editorState.scroll.left,
        });
      }
      if (file.editorState.selection) {
        const { start, end } = file.editorState.selection;
        editor.setSelection({
          startLineNumber: start.line,
          startColumn: start.column,
          endLineNumber: end.line,
          endColumn: end.column,
        });
      }
    }

    // Configure keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, handleSave);

    // Track state changes for persistence
    const disposables: any[] = [];

    disposables.push(
      editor.onDidChangeCursorPosition(() => {
        const position = editor.getPosition();
        if (position) {
          onEditorStateChange(file.id, {
            ...file.editorState,
            cursor: { line: position.lineNumber, column: position.column },
          });
        }
      })
    );

    disposables.push(
      editor.onDidScrollChange((e: any) => {
        onEditorStateChange(file.id, {
          ...file.editorState,
          scroll: { top: e.scrollTop, left: e.scrollLeft },
        });
      })
    );

    disposables.push(
      editor.onDidChangeCursorSelection((e: any) => {
        onEditorStateChange(file.id, {
          ...file.editorState,
          selection: {
            start: {
              line: e.selection.startLineNumber,
              column: e.selection.startColumn,
            },
            end: {
              line: e.selection.endLineNumber,
              column: e.selection.endColumn,
            },
          },
        });
      })
    );

    // Focus editor after mount for immediate typing
    editor.focus();

    return () => {
      disposables.forEach((d) => d.dispose());
    };
  };

  // Handle Escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullScreen) {
        // Exit fullscreen
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFullScreen]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Force relayout when the container size changes
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      if (!isFullScreen && editorRef.current) {
        setTimeout(() => editorRef.current.layout(), 10);
      }
    });

    if (editorContainerRef.current) {
      resizeObserver.observe(editorContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [isFullScreen]);

  // Always reset width when not in fullscreen
  useEffect(() => {
    if (!isFullScreen) {
      // Use a very short timeout to ensure DOM is ready
      setTimeout(() => {
        if (editorRef.current) {
          // This forces the editor to recalculate its size
          setEditorWidth("100%");
          setEditorHeight("100%");
          editorRef.current.layout();
        }
      }, 5);
    }
  }, [isFullScreen]);

  // When visibility changes, ensure editor layout is updated
  useEffect(() => {
    if (isVisible && editorRef.current) {
      // Update editor layout after visibility change
      setTimeout(() => {
        if (editorRef.current) {
          updateEditorDimensions();
          editorRef.current.layout();
        }
      }, 50);
    }
  }, [isVisible]);

  // Get platform-specific command key symbols
  const isMac =
    typeof navigator !== "undefined" && navigator.platform.indexOf("Mac") === 0;
  const cmdKey = isMac ? "⌘" : "Ctrl";
  const altKey = isMac ? "⌥" : "Alt";

  const handleEditorChange = (value: string | undefined) => {
    const newContent = value || "";
    setEditorContent(newContent); // Update content in session storage
    const dirty = newContent !== file.content; // Compare with original content from props for dirty state
    onChange(file.id, newContent, dirty);
  };

  const handleSaveWithHotkey = useCallback(() => {
    if (file.isDirty) {
      onSave();
      // After save, the session content IS the new "original"
      // setEditorContent(currentContentRef.current) // This is implicitly handled by onSave updating file.content potentially
    }
  }, [file.isDirty, onSave]);

  useHotkeys(
    "ctrl+s, cmd+s",
    (event) => {
      event.preventDefault();
      handleSaveWithHotkey();
    },
    { enableOnFormTags: true, enableOnContentEditable: true },
    [handleSaveWithHotkey]
  );

  const handleShowDiff = async () => {
    try {
      // Fetch the original content from the server for diffing
      const originalFile = await fileService.getFileContent(appId, file.id);
      setEditorContent(originalFile.content);
    } catch (error) {
      console.error("Error fetching original file content for diff:", error);
      // Handle error (e.g., show a notification)
    }
  };

  const effectiveContent = isFullScreen ? editorContent : file.content;

  return (
    <div
      ref={containerRef}
      className={`
        flex flex-col
        ${
          isFullScreen && !disableFullScreen
            ? "fixed inset-0 z-[9999] bg-gray-950"
            : "h-full relative"
        }
        transition-all duration-300 ease-in-out
      `}
    >
      {/* Header section */}
      <div
        className={`
        flex-none p-2 bg-gray-800 border-b border-gray-700 
        flex items-center justify-between sticky top-0
        ${isFullScreen && !disableFullScreen ? "shadow-lg px-4" : ""}
      `}
      >
        <div className="flex items-center">
          <span
            className={`
            font-medium flex items-center gap-2
            ${isFullScreen ? "text-lg text-white" : "text-white"}
          `}
          >
            {isFullScreen && <FaFile className="text-blue-400" />}
            {file.name}
          </span>
          {file.isDirty && (
            <FaCircle
              className="text-yellow-400 ml-2"
              size={isFullScreen ? 10 : 8}
              title="Unsaved changes"
            />
          )}
          {isFullScreen && (
            <span className="ml-4 text-sm text-gray-400 hidden md:inline-block">
              {file.filePath} • Press ESC to exit fullscreen
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isFullScreen && allFiles.length > 1 && (
            <button
              onClick={toggleFilesView}
              className={`
                p-2 rounded-md transition-colors
                ${
                  showFilesList
                    ? "bg-gray-700 text-white"
                    : "text-gray-300 hover:text-white hover:bg-gray-700"
                }
              `}
              title={`${
                showFilesList ? "Hide" : "Show"
              } All Files (${cmdKey}+${altKey}+O)`}
            >
              {showFilesList ? "Hide Files" : "Files"}
            </button>
          )}
          {isFullScreen && (
            <button
              onClick={toggleTips}
              className={`
                p-2 rounded-md transition-colors
                ${
                  showTips
                    ? "bg-gray-700 text-yellow-400"
                    : "text-gray-300 hover:text-white hover:bg-gray-700"
                }
              `}
              title={`${showTips ? "Hide" : "Show"} Editor Tips`}
            >
              <FaLightbulb />
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!file.isDirty}
            className={`
              p-2 rounded-md transition-colors
              ${
                file.isDirty
                  ? "text-green-400 hover:text-green-300 hover:bg-gray-700"
                  : "text-gray-500"
              }
            `}
            title={`Save (${cmdKey}+S)`}
          >
            <FaSave />
          </button>
          {/* Only show fullscreen button if not disabled */}
          {!disableFullScreen && (
            <button
              className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
              title={`${
                isFullScreen ? "Exit Full Screen" : "Full Screen"
              } (${cmdKey}+${altKey}+F)`}
            >
              {isFullScreen ? <FaCompress /> : <FaExpand />}
            </button>
          )}
          <button
            onClick={() => {
              // Confirm before closing if there are unsaved changes
              if (
                file.isDirty &&
                !confirm("You have unsaved changes. Close anyway?")
              ) {
                return;
              }
              if (isFullScreen && !disableFullScreen) {
                // Exit fullscreen before closing
              }
              onClose();
            }}
            className="p-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
            title="Close"
          >
            <FaTimes />
          </button>
        </div>
      </div>

      {/* Tips section */}
      {isFullScreen && showTips && (
        <div className="bg-yellow-900/30 border-b border-yellow-700/50 p-3 text-yellow-100">
          <h3 className="font-semibold flex items-center gap-2 mb-1">
            <FaLightbulb className="text-yellow-400" /> Editor Tips
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="font-mono bg-gray-800 px-1 rounded">
                {cmdKey}+S
              </span>{" "}
              Save file •
              <span className="font-mono bg-gray-800 px-1 rounded ml-2">
                ESC
              </span>{" "}
              Exit fullscreen
            </div>
            <div>
              <span className="font-mono bg-gray-800 px-1 rounded">
                {cmdKey}+F
              </span>{" "}
              Find •
              <span className="font-mono bg-gray-800 px-1 rounded ml-2">
                {cmdKey}+/
              </span>{" "}
              Toggle comment
            </div>
            <div>
              <span className="font-mono bg-gray-800 px-1 rounded">
                {cmdKey}+Z
              </span>{" "}
              Undo •
              <span className="font-mono bg-gray-800 px-1 rounded ml-2">
                {cmdKey}+Shift+Z
              </span>{" "}
              Redo
            </div>
          </div>
        </div>
      )}

      {/* Files list section */}
      {isFullScreen && showFilesList && (
        <div
          className="bg-gray-800 p-4 border-b border-gray-700 overflow-y-auto"
          style={{ maxHeight: "300px" }}
        >
          <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
            <FaFile className="text-blue-400" /> All Files ({allFiles.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {allFiles.map((f) => (
              <div
                key={f.id}
                className={`
                  p-3 rounded border border-gray-600 hover:bg-gray-700/70 cursor-pointer
                  transition-colors
                  ${
                    f.id === file.id
                      ? "bg-gray-700 border-blue-500 shadow-md"
                      : ""
                  }
                `}
                onClick={() => {
                  if (
                    file.isDirty &&
                    !confirm("You have unsaved changes. Switch files anyway?")
                  ) {
                    return;
                  }
                  if (onOpenFile) {
                    onOpenFile(f);
                  }
                }}
              >
                <div className="font-medium flex items-center justify-between">
                  {f.name}
                  {f.id === file.id && (
                    <span className="bg-blue-500 text-xs px-1 py-0.5 rounded-sm text-white">
                      Current
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-400 truncate">
                  {f.filePath}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Modified: {new Date(f.modifiedAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editor section */}
      <div
        className={`
        flex-1 relative min-h-0 overflow-hidden w-full
        ${isFullScreen && showFilesList ? "border-t border-gray-700" : ""}
      `}
      >
        <Editor
          height={editorHeight}
          width={editorWidth}
          defaultLanguage={getLanguageFromPath(file.filePath)}
          theme="vs-dark"
          value={effectiveContent}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          options={{
            fontSize: 14,
            fontFamily: "'Cascadia Code', Consolas, 'Courier New', monospace",
            fontLigatures: true,
            minimap: { enabled: true },
            scrollbar: {
              verticalScrollbarSize: 10,
              alwaysConsumeMouseWheel: false,
            },
            lineNumbers: "on",
            wordWrap: "on",
            automaticLayout: true,
            scrollBeyondLastLine: false,
            padding: { top: 10 },
            renderWhitespace: "selection",
            quickSuggestions: true,
            formatOnPaste: true,
            autoIndent: "full",
            matchBrackets: "always",
            renderLineHighlight: "all",
            cursorBlinking: "smooth",
            smoothScrolling: true,
          }}
        />
      </div>
    </div>
  );
};
