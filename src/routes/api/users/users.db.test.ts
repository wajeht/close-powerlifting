import { describe, expect, it, beforeEach } from "vite-plus/test";

import { knex } from "../../../tests/test-setup";
import { buildUserProfileFromLifts, createUserService } from "./users.service";
import { nameToSlug } from "../../../utils/ingest";

const johnRows = [
  {
    name: "John Haack",
    name_slug: nameToSlug("John Haack"),
    sex: "M",
    event: "SBD",
    equipment: "Raw",
    age: 28,
    age_class: "24-34",
    division: "Open",
    bodyweight_kg: 100,
    weight_class_kg: 100,
    squat1_kg: 350,
    squat2_kg: 360,
    squat3_kg: -370,
    squat4_kg: null,
    bench1_kg: 230,
    bench2_kg: 240,
    bench3_kg: -250,
    bench4_kg: null,
    deadlift1_kg: 380,
    deadlift2_kg: 400,
    deadlift3_kg: -420,
    deadlift4_kg: null,
    best3_squat_kg: 360,
    best3_bench_kg: 240,
    best3_deadlift_kg: 400,
    total_kg: 1000,
    place: "1",
    dots: 600.5,
    federation: "WRPF",
    date: "2024-05-12",
    meet_country: "USA",
    meet_state: "CA",
    meet_name: "WRPF AMERICAN PRO",
  },
  {
    name: "John Haack",
    name_slug: nameToSlug("John Haack"),
    sex: "M",
    event: "SBD",
    equipment: "Wraps",
    age: 27,
    age_class: "24-34",
    division: "Open",
    bodyweight_kg: 98,
    weight_class_kg: 100,
    squat1_kg: 340,
    squat2_kg: 355,
    squat3_kg: -365,
    squat4_kg: null,
    bench1_kg: 220,
    bench2_kg: 235,
    bench3_kg: -245,
    bench4_kg: null,
    deadlift1_kg: 370,
    deadlift2_kg: 395,
    deadlift3_kg: 410,
    deadlift4_kg: null,
    best3_squat_kg: 355,
    best3_bench_kg: 235,
    best3_deadlift_kg: 410,
    total_kg: 1000,
    place: "2",
    dots: 595.2,
    federation: "USAPL",
    date: "2023-08-15",
    meet_country: "USA",
    meet_state: null,
    meet_name: "Raw Nationals",
  },
];

describe("users db profile", () => {
  const userService = createUserService(knex, {} as never);

  beforeEach(async () => {
    await knex("lifts").delete();
    await knex("lifts").insert(johnRows);
  });

  it("returns null when no rows for slug", async () => {
    const result = await userService.fetchUserProfileFromDb("nonexistent");
    expect(result).toBeNull();
  });

  it("returns profile shaped like the HTML scrape path", async () => {
    const profile = await userService.fetchUserProfileFromDb("johnhaack", false, "kg");
    expect(profile).not.toBeNull();
    expect(profile?.name).toBe("John Haack");
    expect(profile?.username).toBe("johnhaack");
    expect(profile?.sex).toBe("M");
    expect(profile?.instagram).toBe("");
    expect(profile?.instagram_url).toBe("");
    expect(profile?.competition_results.length).toBe(2);
  });

  it("orders competition results by date descending", async () => {
    const profile = await userService.fetchUserProfileFromDb("johnhaack", false, "kg");
    const dates = profile!.competition_results.map((r) => r.date);
    expect(dates).toEqual(["2024-05-12", "2023-08-15"]);
  });

  it("strips numbered attempt columns by default", async () => {
    const profile = await userService.fetchUserProfileFromDb("johnhaack", false, "kg");
    const first = profile!.competition_results[0]!;
    expect(first).toHaveProperty("squat");
    expect(first).toHaveProperty("bench");
    expect(first).toHaveProperty("deadlift");
    expect(first).not.toHaveProperty("squat1");
    expect(first).not.toHaveProperty("bench3");
  });

  it("includes attempts when requested", async () => {
    const profile = await userService.fetchUserProfileFromDb("johnhaack", true, "kg");
    const first = profile!.competition_results[0]!;
    expect(first).toHaveProperty("squat1");
    expect(first.squat1).toBe("350");
    expect(first.squat3).toBe("-370");
    expect(first).not.toHaveProperty("squat");
  });

  it("uses best3 lifts for stripped view", async () => {
    const profile = await userService.fetchUserProfileFromDb("johnhaack", false, "kg");
    const first = profile!.competition_results[0]!;
    expect(first.squat).toBe("360");
    expect(first.bench).toBe("240");
    expect(first.deadlift).toBe("400");
    expect(first.total).toBe("1000");
  });

  it("formats location as country-state when both present", async () => {
    const profile = await userService.fetchUserProfileFromDb("johnhaack", false, "kg");
    expect(profile!.competition_results[0]!.location).toBe("USA-CA");
    expect(profile!.competition_results[1]!.location).toBe("USA");
  });

  it("groups personal bests by equipment with max values", async () => {
    const profile = await userService.fetchUserProfileFromDb("johnhaack", false, "kg");
    const bests = profile!.personal_best;
    expect(bests.length).toBe(2);
    const raw = bests.find((b) => b.equip === "Raw");
    const wraps = bests.find((b) => b.equip === "Wraps");
    expect(raw?.squat).toBe("360");
    expect(raw?.deadlift).toBe("400");
    expect(raw?.total).toBe("1000");
    expect(wraps?.squat).toBe("355");
    expect(wraps?.deadlift).toBe("410");
  });
});

describe("buildUserProfileFromLifts pure builder", () => {
  it("returns null for empty rows", () => {
    expect(buildUserProfileFromLifts([], "any", false)).toBeNull();
  });
});
