import { describe, expect, it } from "vite-plus/test";

import { createTestContext } from "../../../tests/fixtures";
import { createHealthCheckService } from "./health-check.service";

describe("health-check service", () => {
  it("reports ready when the store is populated", () => {
    const { store } = createTestContext();
    const service = createHealthCheckService(store);
    expect(service.isReady()).toBe(true);
    expect(service.getHealthCheck().data).toBe("ready");
  });

  it("reports loading when the store has not been populated", () => {
    const { store } = createTestContext();
    store.reset();
    const service = createHealthCheckService(store);
    expect(service.isReady()).toBe(false);
    expect(service.getHealthCheck().data).toBe("loading");
  });
});
