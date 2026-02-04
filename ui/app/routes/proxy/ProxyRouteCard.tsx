import React, { memo } from "react";
import type { ProxyRoute } from "~/types/ProxyRoute";
import {
  FaGlobe, FaCopy, FaExternalLinkAlt, FaHeartbeat, FaEdit,
  FaPowerOff, FaTrash, FaLock, FaUnlock, FaArrowRight, FaCode
} from "react-icons/fa";

interface ProxyRouteCardProps {
  route: ProxyRoute;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTestHealth: () => void;
  onCopyUrl: (url: string) => void;
  isHealthChecking: boolean;
}

export const ProxyRouteCard = memo(function ProxyRouteCard({
  route, onToggle, onEdit, onDelete, onTestHealth, onCopyUrl, isHealthChecking
}: ProxyRouteCardProps) {
  const recommendedUrl = route.urls?.recommended || route.urls?.subdomain || route.urls?.pathPrefix;

  return (
    <div 
      className={`card-elevated transition-opacity ${!route.isEnabled ? 'opacity-60' : ''}`}
      role="article"
      aria-label={`Proxy route: ${route.name}`}
    >
      <div className="flex items-start justify-between">
        {/* Left: Info */}
        <div className="flex items-start gap-4">
          <div 
            className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl
              ${route.isHealthy 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : 'bg-rose-500/20 text-rose-400'}`}
            aria-label={route.isHealthy ? 'Healthy' : 'Unhealthy'}
          >
            {route.icon ? route.icon : <FaGlobe aria-hidden="true" />}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-semibold text-slate-100">{route.name}</h3>
              {route.requireAuth ? (
                <FaLock className="text-amber-400 text-xs" title="Authentication required" aria-label="Authentication required" />
              ) : (
                <FaUnlock className="text-slate-500 text-xs" title="Public access" aria-label="Public access" />
              )}
              <span className={`px-2 py-0.5 text-xs rounded-full ${
                route.isEnabled 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : 'bg-slate-700 text-slate-400'
              }`}>
                {route.isEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            
            {route.description && (
              <p className="text-sm text-slate-500 mb-2">{route.description}</p>
            )}
            
            {/* Target URL */}
            <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
              <FaArrowRight className="text-xs" aria-hidden="true" />
              <span className="font-mono">{route.targetUrl}</span>
            </div>

            {/* Access URLs */}
            <div className="flex flex-wrap gap-2 mt-3" role="group" aria-label="Access URLs">
              {route.subdomain?.enabled && route.urls?.subdomain && (
                <button
                  onClick={() => onCopyUrl(route.urls!.subdomain!)}
                  className="flex items-center gap-1.5 px-2 py-1 bg-cyan-500/10 rounded text-xs text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                  aria-label={`Copy subdomain URL: ${route.urls.subdomain}`}
                >
                  <FaCopy className="text-[10px]" aria-hidden="true" />
                  Subdomain
                </button>
              )}
              {route.pathPrefix?.enabled && route.urls?.pathPrefix && (
                <button
                  onClick={() => onCopyUrl(route.urls!.pathPrefix!)}
                  className="flex items-center gap-1.5 px-2 py-1 bg-violet-500/10 rounded text-xs text-violet-400 hover:bg-violet-500/20 transition-colors"
                  aria-label={`Copy path prefix URL: ${route.urls.pathPrefix}`}
                >
                  <FaCopy className="text-[10px]" aria-hidden="true" />
                  Path Prefix
                </button>
              )}
              {route.iframe?.enabled && route.urls?.iframe && (
                <button
                  onClick={() => onCopyUrl(route.urls!.iframe!)}
                  className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 rounded text-xs text-amber-400 hover:bg-amber-500/20 transition-colors"
                  aria-label={`Copy iframe URL: ${route.urls.iframe}`}
                >
                  <FaCode className="text-[10px]" aria-hidden="true" />
                  Iframe
                </button>
              )}
              {recommendedUrl && (
                <a
                  href={recommendedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 rounded text-xs text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                  aria-label={`Open ${route.name} in new tab`}
                >
                  <FaExternalLinkAlt className="text-[10px]" aria-hidden="true" />
                  Open
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2" role="group" aria-label="Route actions">
          <button
            onClick={onTestHealth}
            disabled={isHealthChecking}
            className="icon-btn"
            title="Test health"
            aria-label="Test route health"
            aria-busy={isHealthChecking}
          >
            <FaHeartbeat className={isHealthChecking ? "animate-pulse" : ""} aria-hidden="true" />
          </button>
          <button 
            onClick={onEdit} 
            className="icon-btn" 
            title="Edit"
            aria-label={`Edit ${route.name}`}
          >
            <FaEdit aria-hidden="true" />
          </button>
          <button
            onClick={onToggle}
            className={`icon-btn ${route.isEnabled ? 'text-emerald-400' : 'text-slate-500'}`}
            title={route.isEnabled ? 'Disable' : 'Enable'}
            aria-label={route.isEnabled ? `Disable ${route.name}` : `Enable ${route.name}`}
            aria-pressed={route.isEnabled}
          >
            <FaPowerOff aria-hidden="true" />
          </button>
          <button 
            onClick={onDelete} 
            className="icon-btn text-rose-400" 
            title="Delete"
            aria-label={`Delete ${route.name}`}
          >
            <FaTrash aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
});
