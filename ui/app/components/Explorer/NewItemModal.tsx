import React, { useState } from 'react';
import { FaFolder, FaFile, FaTimes } from 'react-icons/fa';
import { explorerService } from '~/services/explorerService';

interface NewItemModalProps {
  targetPath: string;
  type: 'file' | 'folder';
  onClose: () => void;
  onCreated: () => void;
}

export const NewItemModal: React.FC<NewItemModalProps> = ({
  targetPath,
  type,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    // Basic validation
    if (name.includes('/') || name.includes('\\')) {
      setError('Name cannot contain slashes');
      return;
    }

    const fullPath = `${targetPath}/${name.trim()}`;

    setLoading(true);
    setError(null);

    try {
      if (type === 'folder') {
        await explorerService.createDirectory(fullPath);
      } else {
        await explorerService.createFile(fullPath, '');
      }
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.message || `Failed to create ${type}`);
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
            {type === 'folder' ? (
              <FaFolder className="text-amber-400 text-xl" />
            ) : (
              <FaFile className="text-blue-400 text-xl" />
            )}
            <h2 className="text-lg font-semibold text-white">
              New {type === 'folder' ? 'Folder' : 'File'}
            </h2>
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
              {type === 'folder' ? 'Folder' : 'File'} Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === 'folder' ? 'New Folder' : 'newfile.txt'}
              autoFocus
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
            />
          </div>

          <div className="text-sm text-slate-500 mb-4">
            Will be created in: <span className="text-slate-400">{targetPath}/</span>
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
              disabled={loading || !name.trim()}
              className={`
                px-4 py-2 text-sm rounded-lg font-medium transition-all
                ${name.trim() && !loading
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-white'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }
              `}
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewItemModal;
