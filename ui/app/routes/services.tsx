// Services page with app filtering and tree/flat view
import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "~/components/Layout";
import { ServicesFilterBar } from "~/components/ServicesFilterBar";
import { AppGroupedServicesView } from "~/components/AppGroupedServicesView";
import { ServiceCard } from "~/components/ServiceCard";
import { ServiceConfigForm } from "~/components/ServiceConfigForm";
import { type ServiceFormData, type Service } from "~/types/Service";
import { useToast } from "~/components/Toast";
import { Modal } from "~/components/Modal";
import { ServiceCardGridSkeleton } from "~/components/Skeletons/ServiceCardSkeleton";
import { EmptyStatePresets } from "~/components/EmptyState";
import { useAppsWithStatsQuery, appsQueryKeys } from "~/hooks/useAppsQueries";
import { useAppsQuery, useUpdateAppMutation, appQueryKeys } from "~/hooks/useServiceQueries";

export default function ServicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  
  // Get filter params from URL
  const appIdParam = searchParams.get('appId');
  const viewModeParam = searchParams.get('view') as 'tree' | 'flat' | null;
  
  // Parse selected app IDs from URL (comma-separated)
  const initialAppIds = useMemo(() => appIdParam ? appIdParam.split(',') : [], [appIdParam]);
  
  // Use React Query for data fetching
  const { data: apps = [], isLoading: appsLoading, error: appsError } = useAppsWithStatsQuery();
  const { data: services = [], isLoading: servicesLoading, error: servicesError } = useAppsQuery();
  const updateServiceMutation = useUpdateAppMutation();
  
  const isLoading = appsLoading || servicesLoading;
  const error = appsError || servicesError;
  
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>(initialAppIds);
  const [viewMode, setViewMode] = useState<'tree' | 'flat'>(viewModeParam || 'tree');
  const [selectedServiceForEdit, setSelectedServiceForEdit] = useState<Service | null>(null);

  // Set initial selected apps when apps load
  useEffect(() => {
    if (!appsLoading && apps.length > 0 && selectedAppIds.length === 0 && initialAppIds.length === 0) {
      setSelectedAppIds(apps.map(a => a.id));
    }
  }, [apps, appsLoading, selectedAppIds.length, initialAppIds.length]);

  // Filter services based on selected apps
  const filteredServices = useMemo(() => {
    if (selectedAppIds.length === 0) {
      return [];
    }
    // Show all services if all apps are selected
    if (selectedAppIds.length === apps.length) {
      return services;
    }
    // Filter by selected apps, including unassigned services
    return services.filter(s => 
      !s.appId || selectedAppIds.includes(s.appId)
    );
  }, [services, selectedAppIds, apps.length]);

  // Filter apps to only show those that are selected
  const selectedApps = useMemo(() => {
    return apps.filter(app => selectedAppIds.includes(app.id));
  }, [apps, selectedAppIds]);

  // Update URL when filters change
  useEffect(() => {
    const newParams = new URLSearchParams();
    if (selectedAppIds.length > 0 && selectedAppIds.length < apps.length) {
      newParams.set('appId', selectedAppIds.join(','));
    }
    newParams.set('view', viewMode);
    setSearchParams(newParams, { replace: true });
  }, [selectedAppIds, viewMode, apps.length, setSearchParams]);

  const handleAppFilterChange = (appIds: string[]) => {
    setSelectedAppIds(appIds);
  };

  const handleViewModeChange = (mode: 'tree' | 'flat') => {
    setViewMode(mode);
  };

  const handleEdit = (service: Service) => {
    setSelectedServiceForEdit(service);
  };

  const handleCloseModal = () => {
    setSelectedServiceForEdit(null);
  };

  const handleEditSubmit = async (data: ServiceFormData) => {
    if (selectedServiceForEdit) {
      updateServiceMutation.mutate(
        { appId: selectedServiceForEdit.id, data },
        {
          onSuccess: () => {
            toast.success("Service updated successfully");
            handleCloseModal();
            // Invalidate queries to refresh the data
            queryClient.invalidateQueries({ queryKey: appQueryKeys.all });
          },
          onError: () => {
            toast.error("Failed to update service");
          },
        }
      );
    }
  };

  return (
    <Layout>
      <div className="flex flex-col h-full">
        {/* Filter bar */}
        <ServicesFilterBar
          apps={apps}
          selectedAppIds={selectedAppIds}
          viewMode={viewMode}
          onAppFilterChange={handleAppFilterChange}
          onViewModeChange={handleViewModeChange}
        />

        {/* Services content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <ServiceCardGridSkeleton count={6} />
          ) : error ? (
            <EmptyStatePresets.LoadError onRetry={() => {
              queryClient.invalidateQueries({ queryKey: appsQueryKeys.all });
              queryClient.invalidateQueries({ queryKey: appQueryKeys.all });
            }} />
          ) : selectedAppIds.length === 0 ? (
            <EmptyStatePresets.NoAppsSelected />
          ) : filteredServices.length === 0 ? (
            <EmptyStatePresets.NoServicesFound />
          ) : viewMode === 'tree' ? (
            <AppGroupedServicesView
              apps={selectedApps}
              services={filteredServices}
              onEdit={handleEdit}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredServices.map((service) => {
                const serviceApp = service.appId ? apps.find(a => a.id === service.appId) : null;
                return (
                  <ServiceCard 
                    key={service.id} 
                    service={service}
                    app={serviceApp ? { id: serviceApp.id, name: serviceApp.name, icon: serviceApp.icon } : null}
                    onEdit={handleEdit} 
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Modal for editing service */}
        <Modal
          isOpen={!!selectedServiceForEdit}
          onClose={handleCloseModal}
          title="Edit Service"
          size="lg"
          disableClose={updateServiceMutation.isPending}
        >
          {selectedServiceForEdit && (
            <ServiceConfigForm
              initialData={{
                name: selectedServiceForEdit.name,
                executablePath: selectedServiceForEdit.executablePath,
                arguments: selectedServiceForEdit.arguments,
                workingDirectory: selectedServiceForEdit.workingDirectory,
                environmentVariables: selectedServiceForEdit.environmentVariables,
                accessLink: selectedServiceForEdit.accessLink,
                isExternal: selectedServiceForEdit.isExternal,
                useShellExecute: selectedServiceForEdit.useShellExecute,
                createNoWindow: selectedServiceForEdit.createNoWindow,
                autoStart: selectedServiceForEdit.autoStart,
              }}
              onSubmit={handleEditSubmit}
              submitLabel={updateServiceMutation.isPending ? "Updating..." : "Update Service"}
            />
          )}
        </Modal>
      </div>
    </Layout>
  );
}
