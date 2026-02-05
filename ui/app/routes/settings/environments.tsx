import { Layout } from "~/components/Layout";
import { EnvironmentsEditor } from "~/components/EnvironmentsEditor";

export default function EnvironmentsPage() {
  return (
    <Layout>
      <div className="h-full overflow-auto p-6">
        <EnvironmentsEditor />
      </div>
    </Layout>
  );
}
