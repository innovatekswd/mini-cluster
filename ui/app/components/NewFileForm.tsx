import React, { useState } from "react";
import { FaTimes } from "react-icons/fa";
import { fileService } from "~/services/fileService";

interface NewFileFormProps {
  appId: string;
  onClose: () => void;
  onFileAdded: () => void;
}

export const NewFileForm: React.FC<NewFileFormProps> = ({ appId, onClose, onFileAdded }) => {
  const [name, setName] = useState("");
  const [filePath, setFilePath] = useState("");
  const [initialContent, setInitialContent] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !filePath.trim()) {
      alert("Name and path are required");
      return;
    }

    try {
      setLoading(true);
      await fileService.createFile(appId, {
        name,
        filePath
        //,content: initialContent
      });
      onFileAdded();
      onClose();
    } catch (error) {
      console.error("Failed to add file:", error);
      alert("Failed to add file");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-lg w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Add New File</h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white"
            title="Close"
            aria-label="Close form"
          >
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter a display name for the file"
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              File Path
            </label>
            <p className="text-xs text-gray-400 mb-2">
              You can use variables like {"{BaseDirectory}"} that will be resolved at runtime.
            </p>
            <input
              type="text"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="E.g. {BaseDirectory}/config/settings.json"
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Initial Content (Optional)
            </label>
            <textarea
              value={initialContent}
              onChange={(e) => setInitialContent(e.target.value)}
              placeholder="Enter initial file content or leave blank"
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white font-mono min-h-[100px]"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
            >
              {loading ? "Adding..." : "Add File"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};