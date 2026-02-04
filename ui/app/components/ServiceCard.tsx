import React, { memo } from "react";
import { type Service } from "~/types/Service";

import { useServiceStatus } from "../hooks/useServiceStatus";
import { ServiceControl } from "./ServiceControl";
import { FaExternalLinkAlt, FaEdit } from "react-icons/fa";

interface AppInfo {
  id: string;
  name: string;
  icon?: string;
}

type Props = {
  service: Service;
  app?: AppInfo | null;
  onEdit: (service: Service) => void;
};

export const ServiceCard = memo<Props>(({ service, app, onEdit }) => {
  const realtimeStatus = useServiceStatus(service.id);
  
  return (
    <div className="bg-gray-800 p-6 rounded-xl shadow-lg flex flex-col gap-4 border border-gray-700 hover:shadow-2xl transition-shadow duration-200">
      <div className="flex items-center gap-4 mb-2">
        <div className="flex-1 min-w-0">
          {/* App badge */}
          {app && (
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-sm">{app.icon}</span>
              <span className="text-xs text-gray-400">{app.name}</span>
            </div>
          )}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-lg truncate text-white">
              {service.name}
            </span>
            {service.isExternal && (
              <span className="ml-2 px-2 py-0.5 rounded bg-yellow-700 text-yellow-200 text-xs">
                External
              </span>
            )}
          </div>
          <div className="text-xs text-gray-400 truncate mb-1">
            {service.executablePath}
          </div>
          {service.accessLink && (
            <a
              href={service.accessLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-400 hover:underline text-xs mt-1"
              aria-label={`Open access link for ${service.name}`}
            >
              <FaExternalLinkAlt aria-hidden="true" /> Access Link
            </a>
          )}
          {service.isExternal && (
            <div className="text-xs text-yellow-400">External Service</div>
          )}
          {service.autoStart && (
            <div className="text-xs text-green-400">Auto Start Enabled</div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`inline-block px-2 py-1 text-xs rounded-full font-semibold ${
              realtimeStatus === "Running"
                ? "bg-green-700 text-green-200"
                : "bg-red-700 text-red-200"
            }`}
            role="status"
            aria-label={`Service status: ${realtimeStatus}`}
          >
            {realtimeStatus}
          </span>
          <ServiceControl service={service} />
        </div>
      </div>
      <div className="flex flex-wrap gap-4 items-center justify-between text-xs text-gray-400 mt-2">
        <div>
          <span>Created: {new Date(service.createdAt).toLocaleString()}</span>
          <span className="mx-2">|</span>
          <span>Modified: {new Date(service.modifiedAt).toLocaleString()}</span>
        </div>
        <button
          type="button"
          onClick={() => onEdit(service)}
          className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs shadow"
          aria-label={`Edit ${service.name}`}
        >
          <FaEdit aria-hidden="true" /> Edit
        </button>
      </div>
    </div>
  );
});

ServiceCard.displayName = "ServiceCard";
