import { describe, expect, it } from "vite-plus/test";

import { createTestContext } from "../../../tests/fixtures";
import { createHealthCheckService } from "./health-check.service";

describe("health-check service", () => {
  it("reports ready when the store is populated", () => {
    const { store, cron } = createTestContext();
    const service = createHealthCheckService(store, cron);
    expect(service.isReady()).toBe(true);
    expect(service.getHealthCheck().data).toBe("ready");
    expect(service.getHealthCheck().crons).toBe("started");
  });

  it("reports loading when the store has not been populated", () => {
    const { store, cron } = createTestContext();
    store.reset();
    const service = createHealthCheckService(store, cron);
    expect(service.isReady()).toBe(false);
    expect(service.getHealthCheck().data).toBe("loading");
  });
});
