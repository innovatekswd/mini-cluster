import React from "react";
import { FaTimes, FaCircle } from "react-icons/fa";
import type { OpenFile } from "~/types/ServiceFile";

interface FileTabsProps {
  files: OpenFile[];
  activeFileId: string | null;
  onTabSelect: (fileId: string) => void;
  onTabClose: (fileId: string) => void;
}

export const FileTabs: React.FC<FileTabsProps> = ({ 
  files, 
  activeFileId, 
  onTabSelect, 
  onTabClose 
}) => {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="flex-none border-b border-gray-700 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
      <div className="flex min-w-max">
        {files.map(file => (
          <div
            key={file.id}
            onClick={() => onTabSelect(file.id)}
            className={`
              px-4 py-2 flex items-center gap-2 cursor-pointer
              border-r border-gray-700 min-w-[120px] max-w-[200px] flex-shrink-0
              ${activeFileId === file.id ? "bg-gray-700" : "bg-gray-800 hover:bg-gray-700/50"}
            `}
            title={file.filePath}
          >
            <span className="truncate flex-1 text-sm">{file.name}</span>
            {file.isDirty && (
              <FaCircle className="text-yellow-500 flex-none" size={8} title="Unsaved changes" />
            )}
            <button
              className="text-gray-400 hover:text-white flex-none"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(file.id);
              }}
              title="Close tab"
            >
              <FaTimes size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};