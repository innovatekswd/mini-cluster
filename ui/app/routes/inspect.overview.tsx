import { useState } from "react";
import { CockpitContextProvider } from "~/context/CockpitContext";
import { GlobalContextBar } from "~/components/GlobalContextBar";
import { VitalsStrip } from "~/components/VitalsStrip";
import { WidgetGrid, WidgetCard, WidgetRow } from "~/components/WidgetGrid";
import { LiveChartsWidget } from "~/components/widgets/LiveChartsWidget";
import { LiveLogsWidget } from "~/components/widgets/LiveLogsWidget";
import { TopProcessesWidget } from "~/components/widgets/TopProcessesWidget";
import { ServicesHealthWidget } from "~/components/widgets/ServicesHealthWidget";
import { RecentEventsWidget } from "~/components/widgets/RecentEventsWidget";
import { SparklinesWidget, SPARKLINE_RANGE_OPTIONS, type SparklineRange } from "~/components/widgets/SparklinesWidget";
import { NetworkInterfacesWidget } from "~/components/widgets/NetworkInterfacesWidget";
import {
  FaChartLine,
  FaStream,
  FaList,
  FaHeartbeat,
  FaBolt,
  FaChartArea,
  FaNetworkWired,
} from "react-icons/fa";

const SPARKLINE_RANGE_LABELS: Record<SparklineRange, string> = Object.fromEntries(
  SPARKLINE_RANGE_OPTIONS.map((o) => [o.value, o.label])
) as Record<SparklineRange, string>;

export default function ObserveOverviewPage() {
  const [sparklineRange, setSparklineRange] = useState<SparklineRange>("24h");

  return (
    <CockpitContextProvider>
      <div className="h-full overflow-auto">
        <div className="p-6 space-y-6">
          <GlobalContextBar />
          <VitalsStrip />
          <WidgetGrid>
            <WidgetCard
              title="Live Charts"
              icon={<FaChartLine className="text-cyan-400" />}
              collapsible={true}
            >
              <LiveChartsWidget />
            </WidgetCard>

            <WidgetCard
              title={`${SPARKLINE_RANGE_LABELS[sparklineRange]} Sparklines`}
              icon={<FaChartArea className="text-violet-400" />}
              collapsible={true}
              defaultCollapsed={true}
            >
              <SparklinesWidget selectedRange={sparklineRange} onRangeChange={setSparklineRange} />
            </WidgetCard>

            <WidgetCard
              title="Network Interfaces"
              icon={<FaNetworkWired className="text-emerald-400" />}
              collapsible={true}
            >
              <NetworkInterfacesWidget />
            </WidgetCard>

            <WidgetRow>
              <WidgetCard
                title="Live Logs"
                icon={<FaStream className="text-emerald-400" />}
                collapsible={true}
              >
                <LiveLogsWidget />
              </WidgetCard>

              <WidgetCard
                title="Top Processes"
                icon={<FaList className="text-amber-400" />}
                collapsible={true}
              >
                <TopProcessesWidget />
              </WidgetCard>
            </WidgetRow>

            <WidgetRow>
              <WidgetCard
                title="Services Health"
                icon={<FaHeartbeat className="text-emerald-400" />}
                collapsible={true}
              >
                <ServicesHealthWidget />
              </WidgetCard>

              <WidgetCard
                title="Recent Events"
                icon={<FaBolt className="text-amber-400" />}
                collapsible={true}
              >
                <RecentEventsWidget />
              </WidgetCard>
            </WidgetRow>
          </WidgetGrid>
        </div>
      </div>
    </CockpitContextProvider>
  );
}
