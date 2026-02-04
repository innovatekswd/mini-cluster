import React from "react";
import { FaTimes, FaPlus, FaSync } from "react-icons/fa";
import { Modal } from "~/components/Modal";

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  newUser: {
    username: string;
    password: string;
    email: string;
    role: string;
  };
  setNewUser: React.Dispatch<React.SetStateAction<{
    username: string;
    password: string;
    email: string;
    role: string;
  }>>;
  onSubmit: () => void;
  isLoading: boolean;
}

export const AddUserModal: React.FC<AddUserModalProps> = ({
  isOpen,
  onClose,
  newUser,
  setNewUser,
  onSubmit,
  isLoading,
}) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New User" size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Username <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={newUser.username}
            onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
            className="input-field w-full"
            placeholder="Enter username"
            aria-required="true"
            aria-label="Username"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Password <span className="text-rose-400">*</span>
          </label>
          <input
            type="password"
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            className="input-field w-full"
            placeholder="Min. 6 characters"
            aria-required="true"
            aria-label="Password"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Email
          </label>
          <input
            type="email"
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            className="input-field w-full"
            placeholder="Optional"
            aria-label="Email"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Role
          </label>
          <select
            value={newUser.role}
            onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            className="input-field w-full"
            aria-label="User role"
          >
            <option value="Operator">Operator</option>
            <option value="Admin">Admin</option>
            <option value="Viewer">Viewer</option>
          </select>
        </div>
      </div>
      
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-700">
        <button onClick={onClose} className="btn-secondary">
          Cancel
        </button>
        <button 
          onClick={onSubmit} 
          disabled={isLoading}
          className="btn-primary flex items-center gap-2"
          aria-busy={isLoading}
        >
          {isLoading ? <FaSync className="animate-spin" aria-hidden="true" /> : <FaPlus aria-hidden="true" />}
          Create User
        </button>
      </div>
    </Modal>
  );
};

export default AddUserModal;
