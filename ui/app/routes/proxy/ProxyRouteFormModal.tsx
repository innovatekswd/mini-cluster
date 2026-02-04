import React, { useState } from "react";
import { Modal } from "~/components/Modal";
import { useToast } from "~/components/Toast";
import { proxyService } from "~/services/proxyService";
import type { ProxyRoute, ProxySettings, CreateProxyRouteDto } from "~/types/ProxyRoute";
import { FaSync, FaCheck } from "react-icons/fa";

interface ProxyRouteFormModalProps {
  route: ProxyRoute | null;
  settings: ProxySettings | null;
  onClose: () => void;
  onSuccess: (route: ProxyRoute) => void;
}

export function ProxyRouteFormModal({ route, settings, onClose, onSuccess }: ProxyRouteFormModalProps) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<CreateProxyRouteDto>({
    name: route?.name || '',
    description: route?.description || '',
    icon: route?.icon || '',
    targetUrl: route?.targetUrl || '',
    enablePathPrefix: route?.pathPrefix?.enabled || false,
    pathPrefix: route?.pathPrefix?.prefix || '',
    rewriteUrls: route?.pathPrefix?.rewriteUrls ?? true,
    rewriteWebSocket: route?.pathPrefix?.rewriteWebSocket || false,
    enableSubdomain: route?.subdomain?.enabled ?? true,
    subdomain: route?.subdomain?.subdomain || '',
    enablePort: route?.port?.enabled || false,
    proxyPort: route?.port?.port,
    enableIframe: route?.iframe?.enabled || false,
    stripXFrameOptions: route?.iframe?.stripXFrameOptions ?? true,
    requireAuth: route?.requireAuth ?? settings?.defaultRequireAuth ?? true,
    allowedRoles: route?.allowedRoles || [],
    timeoutSeconds: 30,
    preserveHostHeader: false,
    customHeaders: {},
  });

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!formData.targetUrl.trim()) {
      toast.error("Target URL is required");
      return;
    }

    try {
      setSaving(true);
      let result: ProxyRoute;
      
      if (route) {
        result = await proxyService.update(route.id, formData);
        toast.success("Route updated");
      } else {
        result = await proxyService.create(formData);
        toast.success("Route created");
      }
      
      onSuccess(result);
    } catch (error) {
      console.error("Failed to save route:", error);
      toast.error("Failed to save route");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={route ? 'Edit Proxy Route' : 'New Proxy Route'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div>
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-3">Basic Info</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="routeName" className="block text-sm font-medium text-slate-300 mb-1">
                Name <span className="text-rose-400">*</span>
              </label>
              <input
                id="routeName"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="input-field w-full"
                placeholder="e.g., Seq Logs"
                required
              />
            </div>
            <div>
              <label htmlFor="routeIcon" className="block text-sm font-medium text-slate-300 mb-1">
                Icon (emoji)
              </label>
              <input
                id="routeIcon"
                type="text"
                value={formData.icon}
                onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                className="input-field w-full"
                placeholder="📊"
                maxLength={4}
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="targetUrl" className="block text-sm font-medium text-slate-300 mb-1">
                Target URL <span className="text-rose-400">*</span>
              </label>
              <input
                id="targetUrl"
                type="url"
                value={formData.targetUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, targetUrl: e.target.value }))}
                className="input-field w-full font-mono"
                placeholder="http://localhost:5341"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="description" className="block text-sm font-medium text-slate-300 mb-1">
                Description
              </label>
              <input
                id="description"
                type="text"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="input-field w-full"
                placeholder="Optional description"
              />
            </div>
          </div>
        </div>

        {/* Access Methods */}
        <div>
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-3">Access Methods</h3>
          
          {/* Subdomain */}
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 mb-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enableSubdomain"
                  checked={formData.enableSubdomain}
                  onChange={(e) => setFormData(prev => ({ ...prev, enableSubdomain: e.target.checked }))}
                  className="rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-500"
                />
                <label htmlFor="enableSubdomain" className="text-sm font-medium text-slate-300">
                  Subdomain Access
                </label>
                <span className="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded">Recommended</span>
              </div>
            </div>
            {formData.enableSubdomain && (
              <div>
                <label htmlFor="subdomain" className="block text-xs text-slate-500 mb-1">
                  Subdomain prefix
                </label>
                <input
                  id="subdomain"
                  type="text"
                  value={formData.subdomain}
                  onChange={(e) => setFormData(prev => ({ ...prev, subdomain: e.target.value.toLowerCase() }))}
                  className="input-field w-full font-mono"
                  placeholder="seq"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Access via: {formData.subdomain || 'seq'}.{settings?.serverIp || settings?.detectedServerIp || '192.168.1.x'}.{settings?.baseDomainType === 'custom' ? settings.customBaseDomain : settings?.baseDomainType || 'nip.io'}
                </p>
              </div>
            )}
          </div>

          {/* Path Prefix */}
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 mb-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enablePathPrefix"
                  checked={formData.enablePathPrefix}
                  onChange={(e) => setFormData(prev => ({ ...prev, enablePathPrefix: e.target.checked }))}
                  className="rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-500"
                />
                <label htmlFor="enablePathPrefix" className="text-sm font-medium text-slate-300">
                  Path Prefix Access
                </label>
              </div>
            </div>
            {formData.enablePathPrefix && (
              <div>
                <label htmlFor="pathPrefix" className="block text-xs text-slate-500 mb-1">
                  Path prefix
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-mono">/proxy/</span>
                  <input
                    id="pathPrefix"
                    type="text"
                    value={formData.pathPrefix}
                    onChange={(e) => setFormData(prev => ({ ...prev, pathPrefix: e.target.value.toLowerCase() }))}
                    className="input-field flex-1 font-mono"
                    placeholder="seq"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Iframe */}
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enableIframe"
                  checked={formData.enableIframe}
                  onChange={(e) => setFormData(prev => ({ ...prev, enableIframe: e.target.checked }))}
                  className="rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-500"
                />
                <label htmlFor="enableIframe" className="text-sm font-medium text-slate-300">
                  Iframe Embed Support
                </label>
              </div>
            </div>
            {formData.enableIframe && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="stripXFrameOptions"
                  checked={formData.stripXFrameOptions}
                  onChange={(e) => setFormData(prev => ({ ...prev, stripXFrameOptions: e.target.checked }))}
                  className="rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-500"
                />
                <label htmlFor="stripXFrameOptions" className="text-xs text-slate-400">
                  Strip X-Frame-Options header (required for embedding)
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Security */}
        <div>
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-3">Security</h3>
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="requireAuth"
                checked={formData.requireAuth}
                onChange={(e) => setFormData(prev => ({ ...prev, requireAuth: e.target.checked }))}
                className="rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-500"
              />
              <label htmlFor="requireAuth" className="text-sm font-medium text-slate-300">
                Require Authentication
              </label>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {formData.requireAuth 
                ? "Users must be authenticated to access this route"
                : "Anyone can access this route (not recommended for sensitive services)"}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700/50">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex items-center gap-2"
            aria-busy={saving}
          >
            {saving ? <FaSync className="animate-spin" aria-hidden="true" /> : <FaCheck aria-hidden="true" />}
            {route ? 'Update Route' : 'Create Route'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
