import React, { useState, useEffect } from "react";
import { FaPlus, FaTrash } from "react-icons/fa";
import {
  useAppArgsQuery,
  useUpdateAppArgsMutation,
} from "../hooks/useServiceQueries";

type ArgsEditorProps = {
  appId: string;
};

export const ArgsEditor: React.FC<ArgsEditorProps> = ({ appId }) => {
  const { data: argsData, isLoading } = useAppArgsQuery(appId);
  const [args, setArgs] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"text" | "list">("list");

  const updateArgsMutation = useUpdateAppArgsMutation({
    onSuccess: () => {
      alert("Arguments saved successfully.");
    },
    onError: (error) => {
      console.error("Error saving arguments:", error);
      alert("Failed to save arguments.");
    },
  });

  useEffect(() => {
    if (argsData) {
      const argsArray =
        typeof argsData === "string"
          ? argsData.split(/\s+/).filter(Boolean)
          : argsData;
      setArgs(argsArray);
    }
  }, [argsData]);

  const handleSave = () => {
    const argsString = args.join(" ");
    updateArgsMutation.mutate({ appId, args: argsString });
  };

  const handleAddArg = () => {
    setArgs([...args, ""]);
  };

  const handleUpdateArg = (index: number, value: string) => {
    const updatedArgs = [...args];
    updatedArgs[index] = value;
    setArgs(updatedArgs);
  };

  const handleDeleteArg = (index: number) => {
    setArgs(args.filter((_, i) => i !== index));
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setArgs(e.target.value.split(/\s+/).filter(Boolean));
  };

  if (isLoading) return <p className="text-gray-400">Loading arguments...</p>;

  return (
    <div className="space-y-4 bg-gray-800 p-4 rounded shadow w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <label className="text-white">View Mode:</label>
          <select
            aria-label="Select view mode"
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as "text" | "list")}
            className="bg-gray-700 text-white px-3 py-1 rounded border border-gray-600"
          >
            <option value="text">Text</option>
            <option value="list">List</option>
          </select>
        </div>
      </div>

      {viewMode === "list" ? (
        <div className="space-y-2">
          {args.map((arg, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={arg}
                onChange={(e) => handleUpdateArg(index, e.target.value)}
                className="flex-1 p-2 border rounded bg-gray-700 text-white border-gray-600"
                placeholder={`Argument ${index + 1}`}
              />
              <button
                onClick={() => handleDeleteArg(index)}
                className="text-gray-400 hover:text-red-500 p-2"
                title="Delete argument"
              >
                <FaTrash />
              </button>
            </div>
          ))}
          <button
            onClick={handleAddArg}
            className="text-gray-400 hover:text-blue-500 flex items-center gap-2 mt-4"
            title="Add argument"
          >
            <FaPlus /> Add Argument
          </button>
        </div>
      ) : (
        <textarea
          value={args.join(" ")}
          onChange={handleTextChange}
          placeholder="Enter command line arguments..."
          className="w-full p-2 border rounded bg-gray-700 text-white resize-vertical min-h-[100px]"
        />
      )}

      <div className="flex justify-end mt-4">
        <button
          onClick={handleSave}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow"
          type="button"
        >
          Save
        </button>
      </div>
    </div>
  );
};
