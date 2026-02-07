import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cronService } from "~/services/cronService";
import { useToast } from "~/components/Toast";
import { getApiErrorMessage } from "~/lib/apiClient";
import type { CreateCronJobDto, UpdateCronJobDto } from "~/types/PostMvpTypes";

export const cronQueryKeys = {
  all: ["cronJobs"] as const,
  detail: (id: string) => ["cronJobs", id] as const,
  runs: (id: string) => ["cronJobs", id, "runs"] as const,
};

export function useCronJobsQuery() {
  return useQuery({
    queryKey: cronQueryKeys.all,
    queryFn: () => cronService.getAll(),
    staleTime: 30_000,
  });
}

export function useCronJobQuery(id: string) {
  return useQuery({
    queryKey: cronQueryKeys.detail(id),
    queryFn: () => cronService.getById(id),
    enabled: !!id,
  });
}

export function useCronJobRunsQuery(id: string) {
  return useQuery({
    queryKey: cronQueryKeys.runs(id),
    queryFn: () => cronService.getRuns(id),
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useCreateCronJobMutation() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (data: CreateCronJobDto) => cronService.create(data),
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: cronQueryKeys.all });
      toast.success(`Cron job "${job.name}" created`);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to create cron job")),
  });
}

export function useUpdateCronJobMutation() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCronJobDto }) =>
      cronService.update(id, data),
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: cronQueryKeys.all });
      qc.invalidateQueries({ queryKey: cronQueryKeys.detail(job.id) });
      toast.success(`Cron job "${job.name}" updated`);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to update cron job")),
  });
}

export function useDeleteCronJobMutation() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => cronService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cronQueryKeys.all });
      toast.success("Cron job deleted");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to delete cron job")),
  });
}

export function useToggleCronJobMutation() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, enable }: { id: string; enable: boolean }) =>
      enable ? cronService.enable(id) : cronService.disable(id),
    onSuccess: (_, { enable }) => {
      qc.invalidateQueries({ queryKey: cronQueryKeys.all });
      toast.success(enable ? "Job enabled" : "Job disabled");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to toggle cron job")),
  });
}

export function useTriggerCronJobMutation() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => cronService.trigger(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: cronQueryKeys.runs(id) });
      qc.invalidateQueries({ queryKey: cronQueryKeys.all });
      toast.success("Cron job triggered");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Failed to trigger cron job")),
  });
}
