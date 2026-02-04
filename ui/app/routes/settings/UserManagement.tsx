import React, { useEffect } from "react";
import {
  FaUsers,
  FaPlus,
  FaTrash,
  FaEdit,
  FaShieldAlt,
  FaTimes,
  FaCheck,
  FaSync,
  FaUser,
} from "react-icons/fa";
import { useUserManagement } from "./useUserManagement";
import { AddUserModal } from "./AddUserModal";
import { EditUserModal } from "./EditUserModal";

interface UserManagementProps {
  onLoad?: () => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ onLoad }) => {
  const {
    currentUser,
    users,
    loadingUsers,
    loadUsers,
    showAddModal,
    openAddModal,
    closeAddModal,
    newUser,
    setNewUser,
    handleCreateUser,
    showEditModal,
    openEditModal,
    closeEditModal,
    editingUser,
    handleUpdateRole,
    showDeleteConfirm,
    setShowDeleteConfirm,
    handleDeleteUser,
    actionLoading,
  } = useUserManagement();

  useEffect(() => {
    loadUsers();
    onLoad?.();
  }, []);

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

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case "Admin":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "Operator":
        return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  };

  return (
    <div className="space-y-6">
      {/* Users Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <FaUsers className="text-cyan-400" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">User Management</h2>
            <p className="text-sm text-slate-500">Manage user accounts and permissions</p>
          </div>
        </div>
        <button
          onClick={openAddModal}
          className="btn-primary flex items-center gap-2"
          aria-label="Add new user"
        >
          <FaPlus aria-hidden="true" />
          Add User
        </button>
      </div>

      {/* Users Table */}
      <div className="card-elevated overflow-hidden">
        {loadingUsers ? (
          <div className="flex items-center justify-center py-12">
            <div 
              className="w-8 h-8 border-4 border-slate-700 border-t-cyan-500 rounded-full animate-spin"
              role="status"
              aria-label="Loading users"
            />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <FaUsers className="mx-auto text-3xl mb-3 opacity-50" aria-hidden="true" />
            <p>No users found</p>
          </div>
        ) : (
          <table className="w-full" role="grid">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  User
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Role
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Last Login
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium ${getRoleGradient(
                          user.role
                        )}`}
                        aria-hidden="true"
                      >
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-200 flex items-center gap-2">
                          {user.username}
                          {user.id === currentUser?.id && (
                            <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">{user.email || "No email"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getRoleBadgeClass(
                        user.role
                      )}`}
                    >
                      {user.role === "Admin" && <FaShieldAlt className="text-[10px]" aria-hidden="true" />}
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        user.isActive
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          user.isActive ? "bg-emerald-400" : "bg-red-400"
                        }`}
                        aria-hidden="true"
                      />
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-400">
                    {user.lastLoginAt ? (
                      <>
                        <span className="block">
                          {new Date(user.lastLoginAt).toLocaleDateString()}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(user.lastLoginAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-500">Never</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEditModal(user)}
                        disabled={actionLoading === user.id}
                        className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors disabled:opacity-50"
                        title="Edit role"
                        aria-label={`Edit ${user.username}'s role`}
                      >
                        <FaEdit aria-hidden="true" />
                      </button>
                      {showDeleteConfirm === user.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={actionLoading === user.id}
                            className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-50"
                            title="Confirm delete"
                            aria-label="Confirm delete user"
                          >
                            {actionLoading === user.id ? (
                              <FaSync className="animate-spin" aria-hidden="true" />
                            ) : (
                              <FaCheck aria-hidden="true" />
                            )}
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(null)}
                            className="p-2 text-slate-400 hover:bg-slate-500/10 rounded-lg transition-colors"
                            title="Cancel"
                            aria-label="Cancel delete"
                          >
                            <FaTimes aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowDeleteConfirm(user.id)}
                          disabled={user.id === currentUser?.id}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={
                            user.id === currentUser?.id
                              ? "Cannot delete yourself"
                              : "Delete user"
                          }
                          aria-label={
                            user.id === currentUser?.id
                              ? "Cannot delete yourself"
                              : `Delete ${user.username}`
                          }
                        >
                          <FaTrash aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Role Capabilities Table */}
      <RoleCapabilitiesTable />

      {/* Info */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
            <FaUsers className="text-cyan-400 text-sm" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-1">About User Roles</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              <strong className="text-amber-400">Admin</strong>: Full access to all features
              including user management, system settings, and API keys.{" "}
              <strong className="text-cyan-400">Operator</strong>: Can manage applications,
              start/stop services, view logs, and access the file manager.{" "}
              <strong className="text-slate-300">Viewer</strong>: Read-only access to view
              services and logs without making any changes.
            </p>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddUserModal
        isOpen={showAddModal}
        onClose={closeAddModal}
        newUser={newUser}
        setNewUser={setNewUser}
        onSubmit={handleCreateUser}
        isLoading={actionLoading === "create"}
      />

      <EditUserModal
        isOpen={showEditModal}
        onClose={closeEditModal}
        user={editingUser}
        onUpdateRole={handleUpdateRole}
        isLoading={!!actionLoading && actionLoading === editingUser?.id}
      />
    </div>
  );
};

/**
 * Role capabilities information table
 */
const RoleCapabilitiesTable: React.FC = () => {
  const capabilities = [
    { name: "View services & logs", admin: true, operator: true, viewer: true },
    { name: "Start/Stop services", admin: true, operator: true, viewer: false },
    { name: "Create/Edit/Delete apps", admin: true, operator: true, viewer: false },
    { name: "Manage environment variables", admin: true, operator: true, viewer: false },
    { name: "Access file manager", admin: true, operator: true, viewer: false },
    { name: "Configure system settings", admin: true, operator: false, viewer: false },
    { name: "Manage users", admin: true, operator: false, viewer: false },
    { name: "Manage API keys", admin: true, operator: false, viewer: false },
  ];

  return (
    <div className="card-elevated overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-slate-700/50">
        <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
          <FaShieldAlt className="text-violet-400" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Role Capabilities</h2>
          <p className="text-sm text-slate-500">Permissions for each role in the system</p>
        </div>
      </div>
      <table className="w-full" role="grid" aria-label="Role capabilities">
        <thead>
          <tr className="border-b border-slate-700/50 bg-slate-800/50">
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              Capability
            </th>
            <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-amber-400 uppercase tracking-wider">
              Admin
            </th>
            <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-cyan-400 uppercase tracking-wider">
              Operator
            </th>
            <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
              Viewer
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/50 text-sm">
          {capabilities.map((cap) => (
            <tr key={cap.name} className="hover:bg-slate-700/20">
              <td className="px-4 py-3 text-slate-300">{cap.name}</td>
              <td className="px-4 py-3 text-center">
                {cap.admin ? (
                  <FaCheck className="inline text-emerald-400" aria-label="Yes" />
                ) : (
                  <FaTimes className="inline text-red-400" aria-label="No" />
                )}
              </td>
              <td className="px-4 py-3 text-center">
                {cap.operator ? (
                  <FaCheck className="inline text-emerald-400" aria-label="Yes" />
                ) : (
                  <FaTimes className="inline text-red-400" aria-label="No" />
                )}
              </td>
              <td className="px-4 py-3 text-center">
                {cap.viewer ? (
                  <FaCheck className="inline text-emerald-400" aria-label="Yes" />
                ) : (
                  <FaTimes className="inline text-red-400" aria-label="No" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UserManagement;
