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
    const metadata = store.tryGet();
    if (metadata == null) return null;
    return {
      lifters: metadata.lifterCount,
      meets: metadata.meetCount,
      entries: metadata.rowCount,
      federations: metadata.federationCount,
      records: metadata.recordCount,
      source_last_modified: metadata.sourceLastModified,
      ingested_at: metadata.ingestedAt,
    };
  }

  return { getStatus };
}
