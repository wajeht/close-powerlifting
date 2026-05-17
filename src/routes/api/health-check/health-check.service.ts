import type { DataStoreType } from "../../../context";

export interface HealthCheckData {
  uptime: number;
  timestamp: number;
  data: "ready" | "loading";
}

export function createHealthCheckService(store: DataStoreType) {
  function getHealthCheck(): HealthCheckData {
    const ready = store.tryGet() != null;
    return {
      uptime: process.uptime(),
      timestamp: Date.now(),
      data: ready ? "ready" : "loading",
    };
  }

  function isReady(): boolean {
    return store.tryGet() != null;
  }

  return { getHealthCheck, isReady };
}
