import { beforeEach, describe, expect, it } from "vite-plus/test";

import { createApp } from "../../app";
import { createTestContext } from "../../tests/fixtures";
import { FederationDetail, FederationRow, FederationStats } from "./federations/federations.schema";
import { MeetDetail, MeetHighlights, MeetSummary } from "./meets/meets.schema";
import { RankingEntry } from "./rankings/rankings.schema";
import { RecordsData } from "./records/records.schema";
import {
  CompareData,
  PersonalBests,
  Progression,
  UserListData,
  UserProfile,
  UserRank,
} from "./users/users.schema";

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  app = createApp(createTestContext());
});

describe("OpenAPI response schemas", () => {
  it("publishes concrete component definitions for every feature response", async () => {
    const res = await app.request("/docs/api.json");
    expect(res.status).toBe(200);

    const spec = await res.json();
    const schemas = spec.components.schemas;
    const responseSchemaNames = [
      "RankingEntry",
      "RecordsData",
      "UserListData",
      "CompareData",
      "ProgressionData",
      "PersonalBestsByEquipment",
      "UserRank",
      "UserProfile",
      "MeetSummary",
      "MeetHighlights",
      "MeetDetail",
      "FederationRow",
      "FederationStats",
      "FederationDetail",
    ];

    for (const name of responseSchemaNames) {
      const schema = schemas[name];
      expect(schema, `${name} should be registered`).toBeDefined();
      expect(
        schema.type ?? schema.allOf ?? schema.anyOf ?? schema.oneOf,
        `${name} should not be an unconstrained schema`,
      ).toBeDefined();
    }
  });

  it("documents pagination on the users list response", async () => {
    const res = await app.request("/docs/api.json");
    const spec = await res.json();
    const schema = spec.paths["/api/users"].get.responses["200"].content["application/json"].schema;

    expect(schema.required).toContain("pagination");
    expect(schema.properties.pagination.$ref).toBe("#/components/schemas/Pagination");
  });

  it("matches representative runtime payloads", async () => {
    const [
      ranking,
      records,
      users,
      comparison,
      progression,
      personalBests,
      userRank,
      userProfile,
      meets,
      meetHighlights,
      meetDetail,
      federations,
      federationStats,
      federationDetail,
    ] = await Promise.all([
      app.request("/api/rankings/1"),
      app.request("/api/records"),
      app.request("/api/users"),
      app.request("/api/users/compare?a=edcoan&b=johnsmith1&units=kg"),
      app.request("/api/users/edcoan/progression?units=kg"),
      app.request("/api/users/edcoan/personal-bests?units=kg"),
      app.request("/api/users/edcoan/rank"),
      app.request("/api/users/edcoan?units=kg&include_attempts=true"),
      app.request("/api/meets"),
      app.request("/api/meets/wrpf/2024-05-12/wrpfamericanpro/highlights?units=kg"),
      app.request("/api/meets/wrpf/2024-05-12/wrpfamericanpro?units=kg"),
      app.request("/api/federations"),
      app.request("/api/federations/wrpf/stats"),
      app.request("/api/federations/wrpf"),
    ]);

    expect(RankingEntry.safeParse((await ranking.json()).data).success).toBe(true);
    expect(RecordsData.safeParse((await records.json()).data).success).toBe(true);
    expect(UserListData.safeParse((await users.json()).data).success).toBe(true);
    expect(CompareData.safeParse((await comparison.json()).data).success).toBe(true);
    expect(Progression.safeParse((await progression.json()).data).success).toBe(true);
    expect(PersonalBests.safeParse((await personalBests.json()).data).success).toBe(true);
    expect(UserRank.safeParse((await userRank.json()).data).success).toBe(true);
    expect(UserProfile.safeParse((await userProfile.json()).data).success).toBe(true);
    expect(MeetSummary.safeParse((await meets.json()).data[0]).success).toBe(true);
    expect(MeetHighlights.safeParse((await meetHighlights.json()).data).success).toBe(true);
    expect(MeetDetail.safeParse((await meetDetail.json()).data).success).toBe(true);
    expect(FederationRow.safeParse((await federations.json()).data[0]).success).toBe(true);
    expect(FederationStats.safeParse((await federationStats.json()).data).success).toBe(true);
    expect(FederationDetail.safeParse((await federationDetail.json()).data).success).toBe(true);
  });
});
