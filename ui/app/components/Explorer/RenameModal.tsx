import React, { useState } from 'react';
import { FaTimes, FaEdit } from 'react-icons/fa';
import { explorerService, type FileItem } from '~/services/explorerService';

interface RenameModalProps {
  item: FileItem;
  onClose: () => void;
  onRenamed: () => void;
}

export const RenameModal: React.FC<RenameModalProps> = ({
  item,
  onClose,
  onRenamed,
}) => {
  const [newName, setNewName] = useState(item.name);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newName.trim()) {
      setError('Name is required');
      return;
    }

    if (newName === item.name) {
      onClose();
      return;
    }

    // Basic validation
    if (newName.includes('/') || newName.includes('\\')) {
      setError('Name cannot contain slashes');
      return;
    }

    // Get the parent directory
    const parentPath = item.path.substring(0, item.path.lastIndexOf('/'));
    const newPath = `${parentPath}/${newName.trim()}`;

    setLoading(true);
    setError(null);

    try {
      await explorerService.move(item.path, newPath);
      onRenamed();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to rename');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <FaEdit className="text-cyan-400 text-xl" />
            <h2 className="text-lg font-semibold text-white">Rename</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <FaTimes className="text-slate-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              New Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              onFocus={(e) => {
                // Select filename without extension
                const lastDot = e.target.value.lastIndexOf('.');
                if (lastDot > 0 && item.type === 'file') {
                  e.target.setSelectionRange(0, lastDot);
                } else {
                  e.target.select();
                }
              }}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
            />
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 bg-rose-500/10 border border-rose-500/50 text-rose-400 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !newName.trim() || newName === item.name}
              className={`
                px-4 py-2 text-sm rounded-lg font-medium transition-all
                ${newName.trim() && newName !== item.name && !loading
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-white'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }
              `}
            >
              {loading ? 'Renaming...' : 'Rename'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RenameModal;
