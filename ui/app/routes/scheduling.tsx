import { CronJobManager } from "~/components/CronJobManager";

export default function SchedulingPage() {
  return (
    <div className="h-full overflow-auto p-6">
      <CronJobManager />
    </div>
  );
}
