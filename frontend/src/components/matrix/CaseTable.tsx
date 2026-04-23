type CaseItem = {
  id: string;
  vk_number: string;
  risk_level?: string;
};

type Props = {
  items: CaseItem[];
  onMarkReviewed?: (id: string) => void;
};

export function CaseTable({ items, onMarkReviewed }: Props) {
  return (
    <table>
      <thead>
        <tr>
          <th>VK</th>
          <th>Risk</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td>{item.vk_number}</td>
            <td>{item.risk_level ?? 'none'}</td>
            <td>
              {onMarkReviewed ? <button onClick={() => onMarkReviewed(item.id)}>Mark Reviewed</button> : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
