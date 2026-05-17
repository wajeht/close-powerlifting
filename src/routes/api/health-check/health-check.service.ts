import type { CronType, DataStoreType } from "../../../context";

export interface HealthCheckData {
  uptime: number;
  timestamp: number;
  data: "ready" | "loading";
  crons: "started" | "stopped";
}

export function createHealthCheckService(store: DataStoreType, cron: CronType) {
  function getHealthCheck(): HealthCheckData {
    const ready = store.tryGet() != null;
    return {
      uptime: process.uptime(),
      timestamp: Date.now(),
      data: ready ? "ready" : "loading",
      crons: cron.getStatus().isRunning ? "started" : "stopped",
    };
  }

  function isReady(): boolean {
    return store.tryGet() != null;
  }

  return { getHealthCheck, isReady };
}
