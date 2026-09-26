// Documents with hundreds of lines post many rows; Prisma's default 5s would abort them.
export const LONG_TX = { timeout: 30_000 };

/**
 * Promise.all for queries inside a transaction: an interactive transaction owns a single
 * connection, so its queries must run one after another (pg refuses overlapping ones).
 */
export async function inSequence<T extends readonly (() => Promise<unknown>)[]>(
  ...queries: T
): Promise<{ -readonly [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  const results: unknown[] = [];
  for (const query of queries) results.push(await query());
  return results as { -readonly [K in keyof T]: Awaited<ReturnType<T[K]>> };
}
