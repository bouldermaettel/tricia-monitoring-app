import { FormEvent, useState } from 'react';
import { DuplicateDialog } from '../components/input/DuplicateDialog';
import { AppShell } from '../components/common/AppShell';
import { useCreateCase, useValidateCase } from '../hooks/useCases';

export function InputDashboard() {
  const [vkNumber, setVkNumber] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const validateCase = useValidateCase();
  const createCase = useCreateCase();

  async function handleValidate(e: FormEvent) {
    e.preventDefault();
    const result = await validateCase.mutateAsync({
      vk_number: vkNumber,
      device_name: deviceName,
      tricia_s: 1,
      tricia_p: 1,
      tricia_d: 1,
      user_s: 1,
      user_d: 1,
    });
    setDuplicateOpen(Boolean(result.duplicate));
  }

  async function handleSave() {
    await createCase.mutateAsync({
      vk_number: vkNumber,
      device_name: deviceName,
      tricia_s: 1,
      tricia_p: 1,
      tricia_d: 1,
      user_s: 1,
      user_d: 1,
      validation_status: 'saved',
    });
  }

  return (
    <AppShell>
      <h1>Input Dashboard</h1>
      <form onSubmit={handleValidate}>
        <label>
          VK Number
          <input aria-label="vk-number" value={vkNumber} onChange={(e) => setVkNumber(e.target.value)} />
        </label>
        <label>
          Device Name
          <input aria-label="device-name" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} />
        </label>
        <button type="submit">Validate</button>
      </form>
      <button onClick={handleSave}>Save</button>
      <DuplicateDialog open={duplicateOpen} onClose={() => setDuplicateOpen(false)} />
    </AppShell>
  );
}
