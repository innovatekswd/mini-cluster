import { useState } from "react";
import { useNavigate } from "react-router";
import { FaPlus, FaPlay, FaStop, FaCopy, FaTrash, FaDatabase } from "react-icons/fa";
import type { CreateAppDto } from "~/types/App";
import { useToast } from "~/components/Toast";
import { useConfirm } from "~/components/ConfirmDialog";
import { CreateAppModal } from "~/components/CreateAppModal";
import { 
  useAppsWithStatsQuery, 
  useCloneAppMutation, 
  useDeleteAppMutationV2,
  useSeedAppsMutation,
  useCreateAppMutationV2
} from "~/hooks/useAppsQueries";
import { ServiceCardGridSkeleton } from "~/components/Skeletons/ServiceCardSkeleton";

export default function AppsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { confirm } = useConfirm();
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // React Query hooks
  const { data: apps = [], isLoading: loading } = useAppsWithStatsQuery();
  const cloneAppMutation = useCloneAppMutation();
  const deleteAppMutation = useDeleteAppMutationV2();
  const seedAppsMutation = useSeedAppsMutation();
  const createAppMutation = useCreateAppMutationV2();

  const handleCreateApp = () => {
    setShowCreateModal(true);
  };

  const handleCreateAppSubmit = async (data: CreateAppDto) => {
    createAppMutation.mutate(data, {
      onSuccess: () => setShowCreateModal(false),
    });
  };

  const handleSeedData = async () => {
    if (apps.length > 0) {
      const confirmed = await confirm({
        title: "Add Sample Data",
        message: "Database already contains apps. This will add more sample data. Continue?",
        confirmLabel: "Continue",
        variant: "warning",
      });
      if (!confirmed) return;
    }
    seedAppsMutation.mutate();
  };

  const handleCloneApp = async (appId: string, appName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    cloneAppMutation.mutate(appId);
  };

  const handleDeleteApp = async (appId: string, appName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await confirm({
      title: "Delete App",
      message: `Are you sure you want to delete "${appName}"? Its services will become unassigned.`,
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;
    deleteAppMutation.mutate({ id: appId, name: appName });
  };

  return (
    <>
    <div className="h-full overflow-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Applications</h1>
            <p className="text-slate-400 text-sm">
              Manage and organize your services into logical groups
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSeedData}
              disabled={seedAppsMutation.isPending}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <FaDatabase size={14} />
              {seedAppsMutation.isPending ? "Seeding..." : "Seed Data"}
            </button>
            <button
              onClick={handleCreateApp}
              className="btn-primary flex items-center gap-2"
            >
              <FaPlus size={14} />
              New App
            </button>
          </div>
        </div>

        {/* Apps Grid */}
        {loading ? (
          <ServiceCardGridSkeleton count={8} />
        ) : apps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-xl font-semibold text-slate-300 mb-2">No Apps Yet</h2>
            <p className="text-slate-500 mb-4">
              Create your first app to organize your services
            </p>
            <button
              onClick={handleCreateApp}
              className="btn-primary flex items-center gap-2"
            >
              <FaPlus size={14} />
              Create App
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {apps.map((app) => (
              <div
                key={app.id}
                className="card-elevated hover:scale-105 transition-transform cursor-pointer group relative"
                onClick={() => navigate(`/apps/${encodeURIComponent(app.slug || app.name)}`)}
              >
                {/* Action buttons (show on hover) */}
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    onClick={(e) => handleCloneApp(app.id, app.name, e)}
                    className="p-2 rounded-lg bg-slate-700/90 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors"
                    title="Clone app"
                  >
                    <FaCopy size={12} />
                  </button>
                  <button
                    onClick={(e) => handleDeleteApp(app.id, app.name, e)}
                    className="p-2 rounded-lg bg-slate-700/90 hover:bg-red-600 text-slate-300 hover:text-white transition-colors"
                    title="Delete app"
                  >
                    <FaTrash size={12} />
                  </button>
                </div>

                {/* Color accent bar */}
                <div
                  className="h-1 rounded-t-xl"
                  style={{ backgroundColor: app.color }}
                />
                
                {/* Card content */}
                <div className="p-5">
                  {/* Icon and name */}
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                      style={{ backgroundColor: `${app.color}20` }}
                    >
                      {app.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white group-hover:text-cyan-400 transition-colors">
                        {app.name}
                      </h3>
                    </div>
                  </div>

                  {/* Description */}
                  {app.description && (
                    <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                      {app.description}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-3 text-sm">
                    {/* Total services */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">Services:</span>
                      <span className="font-medium text-slate-300">
                        {app.serviceCount}
                      </span>
                    </div>

                    {/* Running count */}
                    {app.runningCount > 0 && (
                      <div className="flex items-center gap-1.5">
                        <FaPlay className="text-emerald-400 text-xs" />
                        <span className="font-medium text-emerald-400">
                          {app.runningCount}
                        </span>
                      </div>
                    )}

                    {/* Stopped count */}
                    {app.stoppedCount > 0 && (
                      <div className="flex items-center gap-1.5">
                        <FaStop className="text-slate-500 text-xs" />
                        <span className="font-medium text-slate-500">
                          {app.stoppedCount}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer stats */}
        {apps.length > 0 && (
          <div className="mt-8 p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">
                Showing {apps.length} {apps.length === 1 ? "app" : "apps"}
              </span>
              <div className="flex items-center gap-4">
                <span className="text-slate-400">
                  Total services:{" "}
                  <span className="font-medium text-white">
                    {apps.reduce((sum, app) => sum + app.serviceCount, 0)}
                  </span>
                </span>
                <span className="text-emerald-400">
                  Running:{" "}
                  <span className="font-medium">
                    {apps.reduce((sum, app) => sum + app.runningCount, 0)}
                  </span>
                </span>
              </div>
            </div>
          </div>
        )}
    </div>

    {/* Create App Modal */}
    <CreateAppModal
      isOpen={showCreateModal}
      onClose={() => setShowCreateModal(false)}
      onSubmit={handleCreateAppSubmit}
    />
    </>
  );
}
