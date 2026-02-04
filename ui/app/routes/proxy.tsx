import React, { useState, useCallback } from "react";
import { Layout } from "~/components/Layout";
import { useToast } from "~/components/Toast";
import { useConfirm } from "~/components/ConfirmDialog";
import {
  useProxyDataQuery,
  useToggleProxyRouteMutation,
  useDeleteProxyRouteMutation,
  useTestProxyHealthMutation,
  useUpdateProxySettingsMutation,
} from "~/hooks/useProxyQueries";
import type { ProxyRoute } from "~/types/ProxyRoute";
import { FaGlobe, FaPlus, FaCog, FaSync, FaLink } from "react-icons/fa";
import { ProxyRouteCard } from "./proxy/ProxyRouteCard";
import { ProxySettingsForm } from "./proxy/ProxySettingsForm";
import { ProxyRouteFormModal } from "./proxy/ProxyRouteFormModal";

type TabType = 'routes' | 'settings';

export default function ProxyPage() {
  const toast = useToast();
  const { confirm } = useConfirm();
  
  // React Query hooks
  const { routes, settings, isLoading, refetch } = useProxyDataQuery();
  const toggleMutation = useToggleProxyRouteMutation();
  const deleteMutation = useDeleteProxyRouteMutation();
  const healthMutation = useTestProxyHealthMutation();
  const updateSettingsMutation = useUpdateProxySettingsMutation();
  
  const [activeTab, setActiveTab] = useState<TabType>('routes');
  const [showForm, setShowForm] = useState(false);
  const [editingRoute, setEditingRoute] = useState<ProxyRoute | null>(null);

  const handleToggleRoute = useCallback((id: number) => {
    toggleMutation.mutate(id);
  }, [toggleMutation]);

  const handleDeleteRoute = useCallback(async (id: number) => {
    const confirmed = await confirm({
      title: "Delete Proxy Route",
      message: "Are you sure you want to delete this proxy route? This action cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger"
    });
    if (confirmed) {
      deleteMutation.mutate(id);
    }
  }, [confirm, deleteMutation]);

  const handleTestHealth = useCallback((id: number) => {
    healthMutation.mutate(id);
  }, [healthMutation]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast.info("Copied to clipboard");
  }, [toast]);

  const handleFormSuccess = useCallback((route: ProxyRoute) => {
    setShowForm(false);
    setEditingRoute(null);
    refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div 
            className="w-12 h-12 border-4 border-slate-700 border-t-cyan-500 rounded-full animate-spin"
            role="status"
            aria-label="Loading"
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="h-full overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 
                flex items-center justify-center shadow-lg shadow-orange-500/20">
                <FaGlobe className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-slate-100">Reverse Proxy</h1>
                <p className="text-sm text-slate-500">Expose internal services securely</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => refetch()}
                className="btn-secondary flex items-center gap-2"
              >
                <FaSync className={isLoading ? "animate-spin" : ""} />
                Refresh
              </button>
              <button
                onClick={() => { setEditingRoute(null); setShowForm(true); }}
                className="btn-primary flex items-center gap-2"
              >
                <FaPlus />
                Add Route
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 p-1 bg-slate-800/50 rounded-lg w-fit">
            <button
              onClick={() => setActiveTab('routes')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'routes' 
                  ? 'bg-slate-700 text-white' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FaLink className="inline mr-2" />
              Routes ({routes.length})
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'settings' 
                  ? 'bg-slate-700 text-white' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FaCog className="inline mr-2" />
              Settings
            </button>
          </div>

          {/* Routes Tab */}
          {activeTab === 'routes' && (
            <div className="space-y-4">
              {routes.length === 0 ? (
                <div className="card-elevated text-center py-12">
                  <FaGlobe className="text-4xl text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-300 mb-2">No proxy routes configured</h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Add a route to expose an internal service through MiniCluster
                  </p>
                  <button
                    onClick={() => { setEditingRoute(null); setShowForm(true); }}
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    <FaPlus />
                    Add First Route
                  </button>
                </div>
              ) : (
                routes.map(route => (
                  <ProxyRouteCard
                    key={route.id}
                    route={route}
                    onToggle={() => handleToggleRoute(route.id)}
                    onEdit={() => { setEditingRoute(route); setShowForm(true); }}
                    onDelete={() => handleDeleteRoute(route.id)}
                    onTestHealth={() => handleTestHealth(route.id)}
                    onCopyUrl={copyToClipboard}
                    isHealthChecking={healthMutation.isPending && healthMutation.variables === route.id}
                  />
                ))
              )}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && settings && (
            <ProxySettingsForm 
              settings={settings} 
              onSave={(data) => updateSettingsMutation.mutateAsync(data).then(() => {})}
            />
          )}
        </div>
      </div>

      {/* Route Form Modal */}
      {showForm && (
        <ProxyRouteFormModal
          route={editingRoute}
          settings={settings}
          onClose={() => { setShowForm(false); setEditingRoute(null); }}
          onSuccess={handleFormSuccess}
        />
      )}
    </Layout>
  );
}
