type ControlItem = {
  vk_number: string;
  delay_bucket: string;
  validation_status: string;
};

export function ControlQueueTable({ items }: { items: ControlItem[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>VK</th>
          <th>Status</th>
          <th>Delay</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.vk_number}>
            <td>{item.vk_number}</td>
            <td>{item.validation_status}</td>
            <td>{item.delay_bucket}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
