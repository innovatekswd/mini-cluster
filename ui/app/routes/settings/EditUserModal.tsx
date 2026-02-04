import React from "react";
import { FaShieldAlt, FaUser, FaCheck, FaSync } from "react-icons/fa";
import { Modal } from "~/components/Modal";
import type { User } from "~/services/authService";

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onUpdateRole: (userId: string, role: string) => void;
  isLoading: boolean;
}

const ROLES = ["Admin", "Operator", "Viewer"] as const;

export const EditUserModal: React.FC<EditUserModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateRole,
  isLoading,
}) => {
  if (!isOpen || !user) return null;

  const getRoleGradient = (role: string) => {
    switch (role) {
      case "Admin":
        return "bg-gradient-to-br from-amber-500 to-orange-600";
      case "Operator":
        return "bg-gradient-to-br from-cyan-500 to-blue-600";
      default:
        return "bg-gradient-to-br from-slate-500 to-slate-600";
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "Admin":
        return <FaShieldAlt className="text-amber-400" aria-hidden="true" />;
      case "Operator":
        return <FaUser className="text-cyan-400" aria-hidden="true" />;
      default:
        return <FaUser className="text-slate-400" aria-hidden="true" />;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit User Role" size="md">
      <div className="space-y-4">
        {/* User info card */}
        <div className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${getRoleGradient(
              user.role
            )}`}
            aria-hidden="true"
          >
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-medium text-slate-200">{user.username}</div>
            <div className="text-xs text-slate-500">{user.email || "No email"}</div>
          </div>
        </div>

        {/* Role selection */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Select Role
          </label>
          <div className="space-y-2" role="radiogroup" aria-label="Select user role">
            {ROLES.map((role) => (
              <button
                key={role}
                onClick={() => onUpdateRole(user.id, role)}
                disabled={isLoading || user.role === role}
                role="radio"
                aria-checked={user.role === role}
                className={`w-full p-3 rounded-lg border transition-colors flex items-center justify-between ${
                  user.role === role
                    ? "border-cyan-500 bg-cyan-500/10 text-cyan-400"
                    : "border-slate-600 hover:border-slate-500 text-slate-300"
                } ${isLoading ? "opacity-50" : ""}`}
              >
                <div className="flex items-center gap-2">
                  {getRoleIcon(role)}
                  <span>{role}</span>
                </div>
                {user.role === role && <FaCheck className="text-cyan-400" aria-hidden="true" />}
                {isLoading && <FaSync className="animate-spin" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-6 pt-4 border-t border-slate-700">
        <button onClick={onClose} className="btn-secondary">
          Close
        </button>
      </div>
    </Modal>
  );
};

export default EditUserModal;
