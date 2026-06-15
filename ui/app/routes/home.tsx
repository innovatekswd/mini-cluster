import { CockpitContextProvider } from "~/context/CockpitContext";
import { GlobalContextBar } from "~/components/GlobalContextBar";
import { VitalsStrip } from "~/components/VitalsStrip";
import { QuickActionsBar } from "~/components/QuickActionsBar";
import { WidgetGrid, WidgetCard, WidgetRow } from "~/components/WidgetGrid";
import { LiveChartsWidget } from "~/components/widgets/LiveChartsWidget";
import { LiveLogsWidget } from "~/components/widgets/LiveLogsWidget";
import { TopProcessesWidget } from "~/components/widgets/TopProcessesWidget";
import { ServicesHealthWidget } from "~/components/widgets/ServicesHealthWidget";
import { RecentEventsWidget } from "~/components/widgets/RecentEventsWidget";
import { SparklinesWidget } from "~/components/widgets/SparklinesWidget";
import {
  FaChartLine,
  FaStream,
  FaList,
  FaHeartbeat,
  FaBolt,
  FaChartArea,
} from "react-icons/fa";

export default function HomePage() {
  return (
    <CockpitContextProvider>
      <div className="h-full overflow-auto">
        <div className="p-6 space-y-6">
          {/* Global Context Bar */}
          <GlobalContextBar />

          {/* Vitals Strip */}
          <VitalsStrip />

          {/* Quick Actions */}
          <QuickActionsBar />

          {/* Widget Grid */}
          <WidgetGrid>
            {/* Live Charts - Full Width */}
            <WidgetCard
              title="Live Charts"
              icon={<FaChartLine className="text-cyan-400" />}
              collapsible={true}
            >
              <LiveChartsWidget />
            </WidgetCard>

            {/* Live Logs + Top Processes - Side by Side */}
            <WidgetRow>
              <WidgetCard
                title="Live Logs"
                icon={<FaStream className="text-emerald-400" />}
                viewAllLink="/machines/local/logs"
                viewAllLabel="View All Logs"
                collapsible={true}
              >
                <LiveLogsWidget />
              </WidgetCard>

              <WidgetCard
                title="Top Processes"
                icon={<FaList className="text-amber-400" />}
                viewAllLink="/machines/local/processes"
                viewAllLabel="View All Processes"
                collapsible={true}
              >
                <TopProcessesWidget />
              </WidgetCard>
            </WidgetRow>

            {/* Services Health + Recent Events - Side by Side */}
            <WidgetRow>
              <WidgetCard
                title="Services Health"
                icon={<FaHeartbeat className="text-emerald-400" />}
                viewAllLink="/services"
                viewAllLabel="View All Services"
                collapsible={true}
              >
                <ServicesHealthWidget />
              </WidgetCard>

              <WidgetCard
                title="Recent Events"
                icon={<FaBolt className="text-amber-400" />}
                viewAllLink="/analytics"
                viewAllLabel="View All Events"
                collapsible={true}
              >
                <RecentEventsWidget />
              </WidgetCard>
            </WidgetRow>

            {/* 24h Sparklines - Full Width */}
            <WidgetCard
              title="24h Sparklines"
              icon={<FaChartArea className="text-violet-400" />}
              collapsible={true}
              defaultCollapsed={true}
            >
              <SparklinesWidget />
            </WidgetCard>
          </WidgetGrid>
        </div>
      </div>
    </CockpitContextProvider>
  );
}
