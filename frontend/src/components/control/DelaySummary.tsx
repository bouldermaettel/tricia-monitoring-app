export function DelaySummary({ items }: { items: { delay_bucket: string }[] }) {
  const delayed = items.filter((item) => item.delay_bucket !== 'on_time').length;
  return <p>Delayed cases: {delayed}</p>;
}
