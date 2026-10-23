import { beforeEach, describe, expect, it } from "vite-plus/test";

import { createApp } from "../../app";
import { createWeightClassTestContext } from "../../tests/fixtures";
import { RecordsData } from "./records/records.schema";
import { RankingEntry } from "./rankings/rankings.schema";
import { UserProfile, Progression } from "./users/users.schema";
import { MeetDetail, MeetHighlights } from "./meets/meets.schema";

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  app = createApp(createWeightClassTestContext());
});

describe("weight-class API boundaries", () => {
  it.each(["", "/2024/full-power/by-total", "?age_class=24-34"])(
    "separates capped and open-ended ranking filters: %s",
    async (suffix) => {
      const cappedResponse = await app.request(`/api/rankings/filter/raw/men/100${suffix}`);
      const overResponse = await app.request(`/api/rankings/filter/raw/men/100%2B${suffix}`);
      expect(cappedResponse.status).toBe(200);
      expect(overResponse.status).toBe(200);
      const capped = await cappedResponse.json();
      const over = await overResponse.json();
      expect(capped.pagination.items).toBe(1);
      expect(capped.data).toMatchObject([{ username: "edcoan", weight_class_over: false }]);
      const expectedUsernames = suffix.startsWith("/2024")
        ? ["edcoan"]
        : ["edcoan", "marisrazmanis"];
      expect(over.pagination.items).toBe(expectedUsernames.length);
      expect(over.data.map((entry: { username: string }) => entry.username)).toEqual(
        expectedUsernames,
      );
      for (const entry of over.data) expect(entry.weight_class_over).toBe(true);
      for (const entry of [...capped.data, ...over.data]) {
        expect(RankingEntry.safeParse(entry).success).toBe(true);
      }
    },
  );

  it("keeps a single best entry per athlete when no weight class is specified", async () => {
    const response = await app.request("/api/rankings/filter/raw/men");
    const body = await response.json();
    expect(body.pagination.items).toBe(2);
    expect(body.data).toMatchObject([
      { username: "edcoan", weight_class_over: false },
      { username: "marisrazmanis", weight_class_over: true },
    ]);
  });

  it("ranks each record weight class independently and applies exact class filters", async () => {
    for (const ageQuery of ["", "?age_class=24-34"]) {
      const response = await app.request(`/api/records/raw/men${ageQuery}`);
      expect(response.status).toBe(200);
      const body = await response.json();
      const data = RecordsData.parse(body.data);
      const total = data.categories.find((category) => category.key === "total");
      expect(total?.sections[0]?.records).toMatchObject([
        { weight_class_kg: 100, weight_class_over: false, rank: 1, lift_value: 1080 },
        { weight_class_kg: 100, weight_class_over: true, rank: 1, lift_value: 1055 },
        { weight_class_kg: 100, weight_class_over: true, rank: 2, lift_value: 965 },
      ]);
    }

    for (const over of [false, true]) {
      const response = await app.request(`/api/records/raw/100${over ? "%2B" : ""}`);
      const body = await response.json();
      const data = RecordsData.parse(body.data);
      expect(data.filters.weight_class_over).toBe(over);
      for (const category of data.categories) {
        for (const section of category.sections) {
          for (const record of section.records) expect(record.weight_class_over).toBe(over);
        }
      }
    }
  });

  it("preserves the class in athlete history, progression, meet results, and highlights", async () => {
    const profileResponse = await app.request("/api/users/edcoan?units=lbs");
    const profile = UserProfile.parse((await profileResponse.json()).data);
    expect(profile.competition_results).toMatchObject([
      { weight_class_kg: 100, weight_class_over: true },
      { weight_class_kg: 100, weight_class_over: false },
    ]);

    const progressionResponse = await app.request("/api/users/edcoan/progression?units=kg");
    const progression = Progression.parse((await progressionResponse.json()).data);
    expect(progression.progression).toMatchObject([
      { weight_class_kg: 100, weight_class_over: false },
      { weight_class_kg: 100, weight_class_over: true },
    ]);

    const meetPath = "/api/meets/usapl/2024-09-01/rawpro";
    const meetResponse = await app.request(meetPath);
    const meet = MeetDetail.parse((await meetResponse.json()).data);
    expect(meet.results).toContainEqual(
      expect.objectContaining({
        username: "edcoan",
        weight_class_kg: 100,
        weight_class_over: true,
      }),
    );

    const highlightsResponse = await app.request(`${meetPath}/highlights`);
    const highlights = MeetHighlights.parse((await highlightsResponse.json()).data);
    expect(highlights.highlights.best_total).toMatchObject({
      username: "edcoan",
      weight_class_kg: 100,
      weight_class_over: true,
    });
  });
});
