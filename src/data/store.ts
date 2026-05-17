// Runtime container for the in-memory AppData snapshot. Endpoints read
// through `getAppData()`; the loader populates it via `setAppData()`.
// Reads of the underlying `let` are atomic in V8, so rebuilds just assign
// a new AppData and the previous one becomes GC-eligible once in-flight
// requests release their references.
//
// Why this is a module rather than a class: the AppData reference is a
// process-wide singleton (one snapshot serves all requests), and a `let`
// behind two functions is the smallest expression of that.

import type { AppData } from "./types";
import type { LoggerType } from "../utils/logger";

let APP: AppData | null = null;

export interface DataStoreType {
  // Returns the current snapshot. Throws if the loader hasn't populated it
  // yet — server boot must complete the first load before /healthz reports
  // 200 OK, so this should never fire from a real request path.
  get: () => AppData;
  // Returns the snapshot or null. Use this from /healthz so we can answer
  // "not ready" without throwing.
  tryGet: () => AppData | null;
  // Atomically replaces the snapshot. The previous AppData stays alive
  // until in-flight handlers release their references, then GC reclaims it.
  set: (next: AppData) => void;
  // Test/teardown only.
  reset: () => void;
}

export function createDataStore(logger: LoggerType): DataStoreType {
  function get(): AppData {
    if (APP == null) {
      throw new Error("AppData not ready — boot has not finished loading the CSV");
    }
    return APP;
  }

  function tryGet(): AppData | null {
    return APP;
  }

  function set(next: AppData): void {
    APP = next;
    logger.info(
      `data store ready: ${next.lifters.length} lifters, ${next.meets.length} meets, ${next.entries.length} entries (source last-modified=${next.sourceLastModified ?? "unknown"})`,
    );
  }

  function reset(): void {
    APP = null;
  }

  return { get, tryGet, set, reset };
}
