// Worker entry for the nightly ingest. Spawned by ingest.ts:runNightly() in
// the main API process so SQLite's CREATE INDEX / FTS rebuild / COMMIT phases
// don't block the Express event loop. The worker opens its own knex pool
// against the same .sqlite file — WAL mode lets the main process read while
// the worker writes.
//
// We intentionally do NOT call database.init() here: that runs migrations,
// which would race against the main process's own init() on boot via the
// knex_migrations_lock table. Migrations are the main process's job; the
// worker just needs a working connection.

import { parentPort, workerData } from "node:worker_threads";

import { createContext } from "../context";
import type { IngestWorkerMessage } from "./ingest";

async function main(): Promise<void> {
  if (parentPort == null) {
    throw new Error("ingest-worker must be spawned via worker_threads.Worker");
  }

  // workerData is `any` at the type level; read defensively rather than cast.
  const force = workerData?.options?.force === true;
  const context = createContext();

  let message: IngestWorkerMessage;
  try {
    const result = await context.ingest.runNightlyInProcess({ force });
    message = { ok: true, result };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    message = { ok: false, error: reason };
  }

  parentPort.postMessage(message);

  // Connection close errors at shutdown are non-actionable: the worker is
  // exiting regardless. Swallow rather than fail an otherwise successful run.
  await context.database.stop().catch(() => undefined);
}

void main();
