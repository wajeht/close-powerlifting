// Runtime loader. Reads the pre-built snapshot at boot — nothing more.
// The snapshot is produced by `scripts/build-snapshot.ts` (locally or via
// the weekly `update-data.yml` workflow) and committed to the repo, so the
// container ships with the data baked in. The server never reaches out to
// OpenPowerlifting at runtime.

import type { LoggerType } from "../utils/logger";
import type { DataStoreType } from "./store";
import { loadSnapshot, snapshotExists } from "./snapshot/index";

export interface LoaderResult {
  durationMs: number;
  sourceLastModified: string | null;
  rowCount: number;
}

export interface LoaderType {
  // Reads the on-disk snapshot and hands it to the store. Resolves once
  // the in-memory AppData is populated and /healthz can flip to 200.
  loadInitial: () => Promise<LoaderResult>;
}

export function createLoader(logger: LoggerType, store: DataStoreType): LoaderType {
  async function loadInitial(): Promise<LoaderResult> {
    const startedAt = Date.now();

    if (!snapshotExists()) {
      throw new Error(
        "data snapshot not found. Run `npx tsx scripts/build-snapshot.ts` to build " +
          "it locally, or wait for the weekly GitHub Actions workflow to commit a fresh one.",
      );
    }

    const built = loadSnapshot(logger);
    store.set(built);

    return {
      durationMs: Date.now() - startedAt,
      sourceLastModified: built.sourceLastModified,
      rowCount: built.rowCount,
    };
  }

  return { loadInitial };
}
