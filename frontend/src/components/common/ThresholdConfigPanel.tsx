import { useState } from 'react';
import { useThresholds, useUpdateThresholds } from '../../hooks/useThresholds';

export function ThresholdConfigPanel() {
  const { data } = useThresholds();
  const update = useUpdateThresholds();
  const [acceptance, setAcceptance] = useState<number>(1);
  const [problem, setProblem] = useState<number>(3);

  return (
    <section>
      <h3>Thresholds</h3>
      <p>Current: {data?.acceptance_threshold ?? acceptance}</p>
      <label>
        Acceptance
        <input type="number" value={acceptance} onChange={(e) => setAcceptance(Number(e.target.value))} />
      </label>
      <label>
        Problem
        <input type="number" value={problem} onChange={(e) => setProblem(Number(e.target.value))} />
      </label>
      <button
        onClick={() =>
          update.mutate({
            config_key: 'default',
            acceptance_threshold: acceptance,
            problem_threshold: problem,
            include_excluded_default: false,
          })
        }
      >
        Save Thresholds
      </button>
    </section>
  );
}
