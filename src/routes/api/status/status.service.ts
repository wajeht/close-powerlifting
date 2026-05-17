import type { DataStoreType } from "../../../data/store";

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
    const data = store.tryGet();
    if (data == null) return null;
    return {
      lifters: data.lifters.length,
      meets: data.meets.length,
      entries: data.entries.length,
      federations: data.federations.length,
      records: data.records.length,
      source_last_modified: data.sourceLastModified,
      ingested_at: data.ingestedAt,
    };
  }

  return { getStatus };
}
