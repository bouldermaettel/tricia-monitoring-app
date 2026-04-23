import { AppShell } from '../components/common/AppShell';
import { ExportButton } from '../components/common/ExportButton';
import { DelaySummary } from '../components/control/DelaySummary';
import { ControlQueueTable } from '../components/control/ControlQueueTable';
import { useControlQueue } from '../hooks/useControlQueue';

export function ControlDashboard() {
  const queue = useControlQueue();

  return (
    <AppShell>
      <h1>Control Dashboard</h1>
      <DelaySummary items={queue.data?.items ?? []} />
      <ControlQueueTable items={queue.data?.items ?? []} />
      <ExportButton />
    </AppShell>
  );
}
