import React, { useState, useEffect } from "react";
import { Layout } from "~/components/Layout";
import { ServiceConfigForm } from "~/components/ServiceConfigForm";
import { ServiceCard } from "~/components/ServiceCard";
import { ServiceCardGridSkeleton } from "~/components/Skeletons";
import { useToast } from "~/components/Toast";
import { serviceService } from "~/services/appService";
import type { ServiceFormData, Service } from "~/types/Service";
import { FaPlus, FaTimes, FaSync, FaServer } from "react-icons/fa";

export default function InfrastructurePage() {
  const toast = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddService, setShowAddService] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const loadServices = async () => {
    try {
      setLoading(true);
      const data = await serviceService.getAll();
      setServices(data);
    } catch (err) {
      toast.error("Failed to load services");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const handleCreateService = async (data: ServiceFormData) => {
    try {
      await serviceService.createService(data);
      toast.success("Service created successfully!");
      setShowAddService(false);
      loadServices();
    } catch (err) {
      toast.error("Failed to create service");
      console.error(err);
    }
  };

  const handleUpdateService = async (data: ServiceFormData) => {
    if (!editingService) return;
    try {
      await serviceService.updateService(editingService.id, data);
      toast.success("Service updated successfully!");
      setEditingService(null);
      loadServices();
    } catch (err) {
      toast.error("Failed to update service");
      console.error(err);
    }
  };

  return (
    <Layout>
      <div className="h-full flex flex-col p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 
              flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <FaServer className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-100">Services</h1>
              <p className="text-sm text-slate-500">
                {services.length} service{services.length !== 1 ? "s" : ""} configured
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={loadServices}
              disabled={loading}
              className="btn-secondary p-2"
              title="Refresh"
            >
              <FaSync className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setShowAddService(true)}
              className="btn-primary flex items-center gap-2"
            >
              <FaPlus className="w-3 h-3" />
              <span>Add Service</span>
            </button>
          </div>
        </div>

        {/* Service Grid */}
        {loading ? (
          <ServiceCardGridSkeleton count={6} />
        ) : services.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <FaServer className="w-12 h-12 mb-4 opacity-30" />
            <p>No services configured</p>
            <button
              onClick={() => setShowAddService(true)}
              className="mt-4 text-cyan-400 hover:text-cyan-300 text-sm"
            >
              Add your first service
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-auto">
            {services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onEdit={setEditingService}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Service Modal */}
      {showAddService && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowAddService(false)}
        >
          <div 
            className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 
                  flex items-center justify-center">
                  <FaPlus className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Add Service</h2>
                  <p className="text-sm text-slate-500">Configure a new service</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddService(false)}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-auto max-h-[calc(90vh-100px)]">
              <ServiceConfigForm
                onSubmit={handleCreateService}
                submitLabel="Create Service"
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Service Modal */}
      {editingService && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setEditingService(null)}
        >
          <div 
            className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div>
                <h2 className="text-xl font-semibold text-white">Edit Service</h2>
                <p className="text-sm text-slate-500">{editingService.name}</p>
              </div>
              <button
                onClick={() => setEditingService(null)}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-auto max-h-[calc(90vh-100px)]">
              <ServiceConfigForm
                initialData={{
                  name: editingService.name,
                  executablePath: editingService.executablePath,
                  arguments: editingService.arguments,
                  workingDirectory: editingService.workingDirectory,
                  environmentVariables: editingService.environmentVariables,
                  accessLink: editingService.accessLink,
                  isExternal: editingService.isExternal,
                  useShellExecute: editingService.useShellExecute,
                  createNoWindow: editingService.createNoWindow,
                  autoStart: editingService.autoStart,
                  captureOutput: editingService.captureOutput,
                }}
                onSubmit={handleUpdateService}
                submitLabel="Update Service"
              />
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
