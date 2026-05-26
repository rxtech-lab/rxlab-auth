// Apple App Site Association payload builder.
// Apple expects `webcredentials.apps` as a list of `<TEAMID>.<BUNDLEID>` entries.

export interface AASADocument {
  webcredentials: {
    apps: string[];
  };
}

// Deduplicate and lexicographically sort app IDs for a stable AASA payload.
// Whitespace is trimmed; empty strings are dropped.
export function dedupAndSortAppIds(appIds: readonly string[]): string[] {
  const cleaned = appIds
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  return Array.from(new Set(cleaned)).sort();
}

export function buildAASA(appIds: readonly string[]): AASADocument {
  return {
    webcredentials: {
      apps: dedupAndSortAppIds(appIds),
    },
  };
}
