import { beforeEach, describe, expect, it } from "vite-plus/test";

import { createTestContext } from "../../../tests/fixtures";
import { createStatusService } from "./status.service";

beforeEach(() => {
  createTestContext();
});

describe("status service", () => {
  it("returns the counts of the loaded fixture", () => {
    const { store } = createTestContext();
    const service = createStatusService(store);
    const data = service.getStatus();
    expect(data).not.toBeNull();
    expect(data!.lifters).toBe(5);
    expect(data!.meets).toBe(3);
    expect(data!.entries).toBe(6);
    expect(data!.federations).toBe(3);
  });

  it("returns null when the store has not been populated", () => {
    const { store } = createTestContext();
    store.reset();
    const data = createStatusService(store).getStatus();
    expect(data).toBeNull();
  });
});
