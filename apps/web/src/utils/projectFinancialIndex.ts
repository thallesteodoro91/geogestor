interface ProjectAmountIndexOptions<T> {
  getProjectId: (item: T) => string | null | undefined;
  getAmount: (item: T) => number;
  include?: (item: T) => boolean;
}

export function sumProjectAmounts<T>(
  items: readonly T[],
  { getProjectId, getAmount, include }: ProjectAmountIndexOptions<T>
) {
  const totals = new Map<string, number>();

  for (const item of items) {
    if (include && !include(item)) continue;
    const projectId = getProjectId(item);
    if (!projectId) continue;
    totals.set(projectId, (totals.get(projectId) ?? 0) + getAmount(item));
  }

  return totals;
}
