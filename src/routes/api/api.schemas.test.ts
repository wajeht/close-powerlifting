import { z } from "@hono/zod-openapi";
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

function expectExactSchemaMatch(schema: z.ZodType, payload: unknown) {
  const result = schema.safeParse(payload);
  expect(result.success).toBe(true);
  if (!result.success) return;
  expect(result.data).toStrictEqual(payload);
}

function containsLegacyNullable(value: unknown): boolean {
  if (value == null || typeof value !== "object") return false;
  if ("nullable" in value) return true;
  return Object.values(value).some(containsLegacyNullable);
}

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
      expect(schema.type, `${name} should have a concrete top-level type`).toBeDefined();
    }

    expect(schemas.UserListData.items.type).toBe("object");
    expect(schemas.CompetitionResult.properties.place.anyOf).toContainEqual({ type: "null" });
    expect(containsLegacyNullable(spec)).toBe(false);
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

    for (const response of [
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
    ]) {
      expect(response.status).toBe(200);
    }

    expectExactSchemaMatch(RankingEntry, (await ranking.json()).data);
    expectExactSchemaMatch(RecordsData, (await records.json()).data);
    expectExactSchemaMatch(UserListData, (await users.json()).data);
    expectExactSchemaMatch(CompareData, (await comparison.json()).data);
    expectExactSchemaMatch(Progression, (await progression.json()).data);
    expectExactSchemaMatch(PersonalBests, (await personalBests.json()).data);
    expectExactSchemaMatch(UserRank, (await userRank.json()).data);
    expectExactSchemaMatch(UserProfile, (await userProfile.json()).data);
    expectExactSchemaMatch(MeetSummary, (await meets.json()).data[0]);
    expectExactSchemaMatch(MeetHighlights, (await meetHighlights.json()).data);
    expectExactSchemaMatch(MeetDetail, (await meetDetail.json()).data);
    expectExactSchemaMatch(FederationRow, (await federations.json()).data[0]);
    expectExactSchemaMatch(FederationStats, (await federationStats.json()).data);
    expectExactSchemaMatch(FederationDetail, (await federationDetail.json()).data);
  });
});
