import React, { useState } from "react";
import type { ProxySettings, UpdateProxySettingsDto } from "~/types/ProxyRoute";
import { FaCog, FaSync, FaCheck } from "react-icons/fa";

interface ProxySettingsFormProps {
  settings: ProxySettings;
  onSave: (data: UpdateProxySettingsDto) => Promise<void>;
}

export function ProxySettingsForm({ settings, onSave }: ProxySettingsFormProps) {
  const [formData, setFormData] = useState<UpdateProxySettingsDto>({
    baseDomainType: settings.baseDomainType,
    customBaseDomain: settings.customBaseDomain || '',
    portRangeStart: settings.portRangeStart,
    portRangeEnd: settings.portRangeEnd,
    defaultRequireAuth: settings.defaultRequireAuth,
    serverIp: settings.serverIp || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card-elevated">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
          <FaCog className="text-orange-400" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Proxy Settings</h2>
          <p className="text-sm text-slate-500">Configure global proxy behavior</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Server IP */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div>
            <label htmlFor="serverIp" className="block text-sm font-medium text-slate-300 mb-1">
              Server IP Address
            </label>
            <p className="text-xs text-slate-500">
              Detected: {settings.detectedServerIp || 'Unknown'}
            </p>
          </div>
          <input
            id="serverIp"
            type="text"
            value={formData.serverIp}
            onChange={(e) => setFormData(prev => ({ ...prev, serverIp: e.target.value }))}
            placeholder={settings.detectedServerIp || "Auto-detect"}
            className="input-field"
          />
        </div>

        {/* Base Domain Type */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center border-t border-slate-700/50 pt-6">
          <div>
            <label htmlFor="baseDomainType" className="block text-sm font-medium text-slate-300 mb-1">
              Subdomain DNS Provider
            </label>
            <p className="text-xs text-slate-500">
              nip.io and sslip.io provide free wildcard DNS
            </p>
          </div>
          <select
            id="baseDomainType"
            value={formData.baseDomainType}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              baseDomainType: e.target.value as "nip.io" | "sslip.io" | "custom" 
            }))}
            className="input-field"
          >
            <option value="nip.io">nip.io (recommended)</option>
            <option value="sslip.io">sslip.io</option>
            <option value="custom">Custom domain</option>
          </select>
        </div>

        {/* Custom Domain */}
        {formData.baseDomainType === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div>
              <label htmlFor="customBaseDomain" className="block text-sm font-medium text-slate-300 mb-1">
                Custom Base Domain
              </label>
              <p className="text-xs text-slate-500">
                e.g., proxy.example.com (requires wildcard DNS)
              </p>
            </div>
            <input
              id="customBaseDomain"
              type="text"
              value={formData.customBaseDomain}
              onChange={(e) => setFormData(prev => ({ ...prev, customBaseDomain: e.target.value }))}
              placeholder="proxy.example.com"
              className="input-field"
            />
          </div>
        )}

        {/* Port Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center border-t border-slate-700/50 pt-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Port Range</label>
            <p className="text-xs text-slate-500">
              Ports for port-based proxy access (used: {settings.usedPorts.length})
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={formData.portRangeStart}
              onChange={(e) => setFormData(prev => ({ ...prev, portRangeStart: parseInt(e.target.value) || 5001 }))}
              className="input-field w-24"
              min={1024}
              max={65535}
              aria-label="Port range start"
            />
            <span className="text-slate-500">to</span>
            <input
              type="number"
              value={formData.portRangeEnd}
              onChange={(e) => setFormData(prev => ({ ...prev, portRangeEnd: parseInt(e.target.value) || 5099 }))}
              className="input-field w-24"
              min={1024}
              max={65535}
              aria-label="Port range end"
            />
          </div>
        </div>

        {/* Default Auth */}
        <div className="flex items-center justify-between py-3 border-t border-slate-700/50">
          <div>
            <label htmlFor="defaultRequireAuth" className="block text-sm font-medium text-slate-300">
              Default Require Authentication
            </label>
            <p className="text-xs text-slate-500">
              New routes will require auth by default
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              id="defaultRequireAuth"
              type="checkbox"
              checked={formData.defaultRequireAuth}
              onChange={(e) => setFormData(prev => ({ ...prev, defaultRequireAuth: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 
              peer-focus:ring-cyan-500/50 rounded-full peer 
              peer-checked:after:translate-x-full peer-checked:after:border-white 
              after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
              after:bg-white after:border-gray-300 after:border after:rounded-full 
              after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"
              role="switch"
              aria-checked={formData.defaultRequireAuth}
            />
          </label>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t border-slate-700/50">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
            aria-busy={saving}
          >
            {saving ? <FaSync className="animate-spin" aria-hidden="true" /> : <FaCheck aria-hidden="true" />}
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
