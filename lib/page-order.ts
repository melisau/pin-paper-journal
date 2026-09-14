export function moveItem<T>(items: T[], from: number, to: number) {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length || from === to) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function removeItem<T>(items: T[], index: number) {
  if (index < 0 || index >= items.length) return items;
  return items.filter((_, itemIndex) => itemIndex !== index);
}
