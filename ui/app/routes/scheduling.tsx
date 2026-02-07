import { Layout } from "~/components/Layout";
import { CronJobManager } from "~/components/CronJobManager";

export default function SchedulingPage() {
  return (
    <Layout>
      <div className="h-full overflow-auto p-6">
        <CronJobManager />
      </div>
    </Layout>
  );
}
