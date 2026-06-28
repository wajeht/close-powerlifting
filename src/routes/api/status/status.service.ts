import type { DataStoreType } from "../../../data/database";

export interface StatusData {
  lifters: number;
  meets: number;
  entries: number;
  federations: number;
  records: number;
  source_last_modified: string | null;
  ingested_at: string;
}

export function createStatusService(store: DataStoreType) {
  function getStatus(): StatusData | null {
    const state = store.tryGet();
    if (state == null) return null;
    const { metadata } = state;
    return {
      lifters: metadata.lifters,
      meets: metadata.meets,
      entries: metadata.entries,
      federations: metadata.federations,
      records: metadata.records,
      source_last_modified: metadata.sourceLastModified,
      ingested_at: metadata.builtAt,
    };
  }

  return { getStatus };
}
