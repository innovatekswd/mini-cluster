import { Layout } from "~/components/Layout";
import { VariableGroupsEditor } from "~/components/VariableGroupsEditor";

export default function VariableGroupsPage() {
  return (
    <Layout>
      <div className="h-full overflow-auto p-6">
        <VariableGroupsEditor />
      </div>
    </Layout>
  );
}
