export function sortListsByCreatedAt<T extends { id: string; created_at: string }>(lists: T[]) {
  return [...lists].sort((left, right) => {
    const byCreatedAt = left.created_at.localeCompare(right.created_at);
    return byCreatedAt || left.id.localeCompare(right.id);
  });
}
