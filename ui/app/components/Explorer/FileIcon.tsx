import React from 'react';
import {
  FaFolder,
  FaFolderOpen,
  FaFile,
  FaImage,
  FaVideo,
  FaMusic,
  FaCode,
  FaFileAlt,
} from 'react-icons/fa';
import type { FileItem } from '~/services/explorerService';

interface FileIconProps {
  item: FileItem;
  isOpen?: boolean;
}

/**
 * File icon component that displays appropriate icon based on file type/category
 */
export const FileIcon = React.memo<FileIconProps>(({ item, isOpen }) => {
  if (item.type === 'directory') {
    return isOpen ? (
      <FaFolderOpen className="text-amber-400" aria-hidden="true" />
    ) : (
      <FaFolder className="text-amber-400" aria-hidden="true" />
    );
  }

  switch (item.category) {
    case 'image':
      return <FaImage className="text-pink-400" aria-hidden="true" />;
    case 'video':
      return <FaVideo className="text-purple-400" aria-hidden="true" />;
    case 'audio':
      return <FaMusic className="text-green-400" aria-hidden="true" />;
    case 'text':
      if (['.json', '.xml', '.yaml', '.yml'].includes(item.extension)) {
        return <FaCode className="text-cyan-400" aria-hidden="true" />;
      }
      return <FaFileAlt className="text-blue-400" aria-hidden="true" />;
    default:
      return <FaFile className="text-slate-400" aria-hidden="true" />;
  }
});

FileIcon.displayName = 'FileIcon';

export default FileIcon;
