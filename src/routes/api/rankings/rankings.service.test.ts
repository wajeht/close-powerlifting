import { describe, expect, it } from "vite-plus/test";

import { createContext } from "../../../context";
import { createRankingService } from "./rankings.service";

const context = createContext();
const rankingService = createRankingService(context.knex);

describe("rankings service", () => {
  it("exposes the expected handlers", () => {
    expect(typeof rankingService.getRankings).toBe("function");
    expect(typeof rankingService.getRank).toBe("function");
    expect(typeof rankingService.getFilteredRankings).toBe("function");
    expect(typeof rankingService.fetchRankingsData).toBe("function");
  });
});
