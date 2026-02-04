import React from "react";
import { FileUploadManager } from "~/components/FileUploadManager";
import { Layout } from "~/components/Layout";

export default function FilesPage() {
  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">File Management</h1>
        <FileUploadManager 
          onFileUploaded={() => {
            // File upload handler - refresh list or notify
          }}
          defaultFolder="uploads"
        />
      </div>
    </Layout>
  );
}