import { Outlet } from "react-router";
import { Layout } from "~/components/Layout";
import { useAppsWithStatsQuery } from "~/hooks/useAppsQueries";

/**
 * Persistent layout route that wraps all authenticated pages.
 * Using a layout route prevents the Layout component from unmounting/remounting
 * on every navigation, eliminating the "reloading" effect between pages.
 */
export default function AppLayout() {
  const { data: apps = [] } = useAppsWithStatsQuery();

  const appStats = {
    total: apps.length,
    running: apps.reduce((sum, app) => sum + (app.runningCount || 0), 0),
    stopped: apps.reduce((sum, app) => sum + (app.stoppedCount || 0), 0),
    failed: apps.reduce((sum, app) => sum + (app.failedCount || 0), 0),
  };

  return (
    <Layout appStats={appStats}>
      <Outlet />
    </Layout>
  );
}
