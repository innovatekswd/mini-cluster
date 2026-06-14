import React from "react";
import { FileUploadManager } from "~/components/FileUploadManager";

export default function FilesPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">File Management</h1>
      <FileUploadManager 
        onFileUploaded={() => {
          // File upload handler - refresh list or notify
        }}
        defaultFolder="uploads"
      />
    </div>
  );
}
