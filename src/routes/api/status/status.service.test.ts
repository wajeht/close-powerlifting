import { describe, expect, it } from "vite-plus/test";

import { knex } from "../../../tests/test-setup";
import { createStatusService } from "./status.service";

const statusService = createStatusService(knex);

describe("status service", () => {
  describe("getStatus", () => {
    it("returns StatusData shape", async () => {
      const result = await statusService.getStatus({});
      expect(result.data).toHaveProperty("server_version");
      expect(result.data).toHaveProperty("meets");
      expect(result.data).toHaveProperty("federations");
    });

    it("federations array includes seeded codes", async () => {
      const result = await statusService.getStatus({});
      const codes = result.data!.federations.map((f) => f.name);
      expect(codes).toContain("WRPF");
      expect(codes).toContain("USAPL");
    });

    it("federation entries carry the expected fields", async () => {
      const result = await statusService.getStatus({});
      const first = result.data!.federations[0]!;
      expect(first).toHaveProperty("name");
      expect(first).toHaveProperty("status");
      expect(first).toHaveProperty("meetsentered");
    });

    it("meets blurb mentions Tracking when meets exist", async () => {
      const result = await statusService.getStatus({});
      expect(result.data!.meets).toContain("Tracking");
    });
  });
});
