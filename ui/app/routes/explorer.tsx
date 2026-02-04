import { ExplorerPage } from '~/components/Explorer/ExplorerPage';
import { Layout } from '~/components/Layout';

export default function Explorer() {
  return (
    <Layout>
      <div className="h-full">
        <ExplorerPage />
      </div>
    </Layout>
  );
}
