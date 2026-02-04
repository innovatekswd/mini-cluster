/**
 * User management hook for admin users page
 */
import { useState } from "react";
import { useToast } from "~/components/Toast";
import { useAuth } from "~/context/AuthContext";
import { authService, type User, type CreateUserRequest } from "~/services/authService";

interface NewUserForm {
  username: string;
  password: string;
  email: string;
  role: string;
}

const DEFAULT_NEW_USER: NewUserForm = {
  username: "",
  password: "",
  email: "",
  role: "Operator",
};

export function useUserManagement() {
  const toast = useToast();
  const { accessToken, user: currentUser } = useAuth();
  
  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // New user form
  const [newUser, setNewUser] = useState<NewUserForm>(DEFAULT_NEW_USER);

  const loadUsers = async () => {
    if (!accessToken) return;
    try {
      setLoadingUsers(true);
      const usersData = await authService.getAllUsers(accessToken);
      setUsers(usersData);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      console.error("Failed to load users:", error);
      toast.error(err.response?.data?.error || "Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.password) {
      toast.error("Username and password are required");
      return;
    }
    if (newUser.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (!accessToken) return;
    
    try {
      setActionLoading("create");
      const createRequest: CreateUserRequest = {
        username: newUser.username,
        password: newUser.password,
        email: newUser.email || undefined,
        role: newUser.role,
      };
      await authService.createUser(createRequest, accessToken);
      toast.success(`User "${newUser.username}" created successfully`);
      setShowAddModal(false);
      setNewUser(DEFAULT_NEW_USER);
      await loadUsers();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      console.error("Failed to create user:", error);
      toast.error(err.response?.data?.error || "Failed to create user");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    if (!accessToken) return;
    
    try {
      setActionLoading(userId);
      await authService.updateUserRole(accessToken, userId, newRole);
      toast.success(`User role updated to ${newRole}`);
      setShowEditModal(false);
      setEditingUser(null);
      await loadUsers();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      console.error("Failed to update role:", error);
      toast.error(err.response?.data?.error || "Failed to update role");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!accessToken) return;
    
    try {
      setActionLoading(userId);
      await authService.deleteUser(accessToken, userId);
      toast.success("User deleted");
      setShowDeleteConfirm(null);
      await loadUsers();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      console.error("Failed to delete user:", error);
      toast.error(err.response?.data?.error || "Failed to delete user");
    } finally {
      setActionLoading(null);
    }
  };

  const openAddModal = () => {
    setNewUser(DEFAULT_NEW_USER);
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setNewUser(DEFAULT_NEW_USER);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingUser(null);
  };

  return {
    // Current user
    currentUser,
    
    // Users data
    users,
    loadingUsers,
    loadUsers,
    
    // Add modal
    showAddModal,
    openAddModal,
    closeAddModal,
    newUser,
    setNewUser,
    handleCreateUser,
    
    // Edit modal
    showEditModal,
    openEditModal,
    closeEditModal,
    editingUser,
    handleUpdateRole,
    
    // Delete
    showDeleteConfirm,
    setShowDeleteConfirm,
    handleDeleteUser,
    
    // Loading state
    actionLoading,
  };
}
