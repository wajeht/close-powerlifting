import { Readable } from "node:stream";
import { describe, expect, beforeEach, it } from "vite-plus/test";

import { knex, logger } from "../tests/test-setup";
import { createIngestService, nameToSlug } from "./ingest";

const CSV_HEADER = [
  "Name",
  "Sex",
  "Event",
  "Equipment",
  "Age",
  "AgeClass",
  "BirthYearClass",
  "Division",
  "BodyweightKg",
  "WeightClassKg",
  "Squat1Kg",
  "Squat2Kg",
  "Squat3Kg",
  "Squat4Kg",
  "Bench1Kg",
  "Bench2Kg",
  "Bench3Kg",
  "Bench4Kg",
  "Deadlift1Kg",
  "Deadlift2Kg",
  "Deadlift3Kg",
  "Deadlift4Kg",
  "Best3SquatKg",
  "Best3BenchKg",
  "Best3DeadliftKg",
  "TotalKg",
  "Place",
  "Dots",
  "Wilks",
  "Glossbrenner",
  "Goodlift",
  "Tested",
  "Country",
  "State",
  "Federation",
  "ParentFederation",
  "Date",
  "MeetCountry",
  "MeetState",
  "MeetName",
  "Sanctioned",
].join(",");

function csvRow(values: Partial<Record<string, string | number>>): string {
  const row = [
    values.Name ?? "",
    values.Sex ?? "",
    values.Event ?? "",
    values.Equipment ?? "",
    values.Age ?? "",
    values.AgeClass ?? "",
    values.BirthYearClass ?? "",
    values.Division ?? "",
    values.BodyweightKg ?? "",
    values.WeightClassKg ?? "",
    values.Squat1Kg ?? "",
    values.Squat2Kg ?? "",
    values.Squat3Kg ?? "",
    values.Squat4Kg ?? "",
    values.Bench1Kg ?? "",
    values.Bench2Kg ?? "",
    values.Bench3Kg ?? "",
    values.Bench4Kg ?? "",
    values.Deadlift1Kg ?? "",
    values.Deadlift2Kg ?? "",
    values.Deadlift3Kg ?? "",
    values.Deadlift4Kg ?? "",
    values.Best3SquatKg ?? "",
    values.Best3BenchKg ?? "",
    values.Best3DeadliftKg ?? "",
    values.TotalKg ?? "",
    values.Place ?? "",
    values.Dots ?? "",
    values.Wilks ?? "",
    values.Glossbrenner ?? "",
    values.Goodlift ?? "",
    values.Tested ?? "",
    values.Country ?? "",
    values.State ?? "",
    values.Federation ?? "",
    values.ParentFederation ?? "",
    values.Date ?? "",
    values.MeetCountry ?? "",
    values.MeetState ?? "",
    values.MeetName ?? "",
    values.Sanctioned ?? "",
  ];
  return row.join(",");
}

function buildCsv(rows: Array<Partial<Record<string, string | number>>>): string {
  return [CSV_HEADER, ...rows.map(csvRow)].join("\n");
}

function streamFromString(input: string): Readable {
  return Readable.from([Buffer.from(input)]);
}

const REQUIRED = {
  Event: "SBD",
  Equipment: "Raw",
  Federation: "WRPF",
  MeetName: "AMERICAN PRO",
  Date: "2024-05-12",
};

describe("ingest", () => {
  const ingest = createIngestService(knex, logger);

  beforeEach(async () => {
    await knex("lifts").delete();
    await knex("meets").delete();
    await knex("lifters").delete();
    await knex("federations").delete();
    await knex("ingest_runs").delete();
    await knex.raw("INSERT INTO lifters_fts(lifters_fts) VALUES('rebuild')");
    await knex.raw("INSERT INTO meets_fts(meets_fts) VALUES('rebuild')");
  });

  it("ingests CSV into four normalized tables", async () => {
    const csv = buildCsv([
      { ...REQUIRED, Name: "John Haack", Sex: "M", TotalKg: 1005 },
      { ...REQUIRED, Name: "Jane Doe", Sex: "F", TotalKg: 500 },
    ]);
    const result = await ingest.ingestFromStream(() => streamFromString(csv));

    expect(result.status).toBe("completed");
    expect(result.stats.lifters).toBe(2);
    expect(result.stats.meets).toBe(1);
    expect(result.stats.federations).toBe(1);
    expect(result.stats.lifts).toBe(2);

    const lifterCount = await knex("lifters").count<{ c: number }[]>({ c: "*" });
    const meetCount = await knex("meets").count<{ c: number }[]>({ c: "*" });
    const liftCount = await knex("lifts").count<{ c: number }[]>({ c: "*" });
    expect(Number(lifterCount[0]?.c)).toBe(2);
    expect(Number(meetCount[0]?.c)).toBe(1);
    expect(Number(liftCount[0]?.c)).toBe(2);
  });

  it("dedupes a lifter who appears at multiple meets", async () => {
    const csv = buildCsv([
      { ...REQUIRED, Name: "John Haack", TotalKg: 1000, MeetName: "Meet A" },
      {
        ...REQUIRED,
        Name: "John Haack",
        TotalKg: 1010,
        MeetName: "Meet B",
        Date: "2024-08-20",
      },
    ]);
    await ingest.ingestFromStream(() => streamFromString(csv));

    const lifters = await knex("lifters").count<{ c: number }[]>({ c: "*" });
    const meets = await knex("meets").count<{ c: number }[]>({ c: "*" });
    const lifts = await knex("lifts").count<{ c: number }[]>({ c: "*" });
    expect(Number(lifters[0]?.c)).toBe(1);
    expect(Number(meets[0]?.c)).toBe(2);
    expect(Number(lifts[0]?.c)).toBe(2);
  });

  it("dedupes a meet that has many competitors", async () => {
    const csv = buildCsv([
      { ...REQUIRED, Name: "Alice", TotalKg: 500 },
      { ...REQUIRED, Name: "Bob", TotalKg: 1000 },
      { ...REQUIRED, Name: "Carol", TotalKg: 600 },
    ]);
    await ingest.ingestFromStream(() => streamFromString(csv));

    const meets = await knex("meets").count<{ c: number }[]>({ c: "*" });
    expect(Number(meets[0]?.c)).toBe(1);
  });

  it("computes slugs at ingest time", async () => {
    const csv = buildCsv([
      { ...REQUIRED, Name: "John Smith #1", Federation: "WRPF-UK", MeetName: "U.K. Open" },
    ]);
    await ingest.ingestFromStream(() => streamFromString(csv));

    const lifter = await knex("lifters").first<{ name_slug: string }>();
    const fed = await knex("federations").first<{ slug: string; code: string }>();
    const meet = await knex("meets").first<{ meet_slug: string }>();
    expect(lifter?.name_slug).toBe("johnsmith1");
    expect(fed?.slug).toBe("wrpfuk");
    expect(fed?.code).toBe("WRPF-UK");
    expect(meet?.meet_slug).toBe("ukopen");
  });

  it("normalizes diacritics in slugs but preserves the display name", async () => {
    const csv = buildCsv([{ ...REQUIRED, Name: "Māris Rāzmanis" }]);
    await ingest.ingestFromStream(() => streamFromString(csv));

    const lifter = await knex("lifters").first<{ name: string; name_slug: string }>();
    expect(lifter?.name).toBe("Māris Rāzmanis");
    expect(lifter?.name_slug).toBe("marisrazmanis");
  });

  it("splits Place into place_rank and place_status", async () => {
    const csv = buildCsv([
      { ...REQUIRED, Name: "Winner", Place: "1" },
      { ...REQUIRED, Name: "DQ Lifter", Place: "DQ" },
      { ...REQUIRED, Name: "Guest", Place: "G" },
    ]);
    await ingest.ingestFromStream(() => streamFromString(csv));

    const rows = (await knex("lifts")
      .join("lifters", "lifters.id", "lifts.lifter_id")
      .select<Array<{ name: string; place_rank: number | null; place_status: string | null }>>(
        "lifters.name",
        "lifts.place_rank",
        "lifts.place_status",
      )
      .orderBy("lifters.name")) as Array<{
      name: string;
      place_rank: number | null;
      place_status: string | null;
    }>;

    const byName = Object.fromEntries(rows.map((row) => [row.name, row]));
    expect(byName["Winner"]?.place_rank).toBe(1);
    expect(byName["Winner"]?.place_status).toBeNull();
    expect(byName["DQ Lifter"]?.place_rank).toBeNull();
    expect(byName["DQ Lifter"]?.place_status).toBe("DQ");
    expect(byName["Guest"]?.place_status).toBe("G");
  });

  it("coerces Tested and Sanctioned to booleans", async () => {
    const csv = buildCsv([
      { ...REQUIRED, Name: "Tested Lifter", Tested: "Yes", Sanctioned: "Yes" },
      { ...REQUIRED, Name: "Untested Lifter", Tested: "", Sanctioned: "No", Date: "2024-09-01" },
    ]);
    await ingest.ingestFromStream(() => streamFromString(csv));

    const lifts = (await knex("lifts")
      .join("lifters", "lifters.id", "lifts.lifter_id")
      .select<Array<{ name: string; tested: number }>>("lifters.name", "lifts.tested")) as Array<{
      name: string;
      tested: number;
    }>;
    const byName = Object.fromEntries(lifts.map((r) => [r.name, r]));
    expect(byName["Tested Lifter"]?.tested).toBe(1);
    expect(byName["Untested Lifter"]?.tested).toBe(0);

    const meets = (await knex("meets").select<Array<{ meet_name: string; sanctioned: number }>>(
      "meet_name",
      "sanctioned",
    )) as Array<{ meet_name: string; sanctioned: number }>;
    expect(meets[0]?.sanctioned).toBeDefined();
  });

  it("preserves negative attempts as failures", async () => {
    const csv = buildCsv([
      {
        ...REQUIRED,
        Name: "Test Lifter",
        Squat1Kg: 250,
        Squat2Kg: 270,
        Squat3Kg: -290,
        Best3SquatKg: 270,
      },
    ]);
    await ingest.ingestFromStream(() => streamFromString(csv));

    const lift = await knex("lifts").first<{
      squat1_kg: number;
      squat2_kg: number;
      squat3_kg: number;
      best3_squat_kg: number;
    }>();
    expect(lift?.squat1_kg).toBe(250);
    expect(lift?.squat3_kg).toBe(-290);
    expect(lift?.best3_squat_kg).toBe(270);
  });

  it("skips rows with missing or malformed required fields", async () => {
    const csv = buildCsv([
      { ...REQUIRED, Name: "Valid Lifter" },
      { ...REQUIRED, Name: "" },
      { ...REQUIRED, Name: "Bad Date", Date: "not-a-date" },
      { ...REQUIRED, Name: "No Federation", Federation: "" },
    ]);
    const result = await ingest.ingestFromStream(() => streamFromString(csv));

    expect(result.stats.lifts).toBe(1);
    expect(result.stats.skippedRows).toBe(3);
  });

  it("rebuilds FTS so lifter name search works", async () => {
    const csv = buildCsv([
      { ...REQUIRED, Name: "Jonathan Cayco" },
      { ...REQUIRED, Name: "Kristy Hawkins" },
      { ...REQUIRED, Name: "John Haack" },
    ]);
    await ingest.ingestFromStream(() => streamFromString(csv));

    const matches = (await knex.raw<Array<{ name: string }>>(
      "SELECT name FROM lifters_fts WHERE lifters_fts MATCH 'jon*'",
    )) as unknown as Array<{ name: string }>;
    const names = matches.map((row) => row.name);
    expect(names).toContain("Jonathan Cayco");
  });

  it("rebuilds FTS so meet name search works", async () => {
    const csv = buildCsv([
      { ...REQUIRED, Name: "A", MeetName: "WRPF AMERICAN PRO" },
      { ...REQUIRED, Name: "B", MeetName: "USAPL Raw Nationals", Federation: "USAPL" },
    ]);
    await ingest.ingestFromStream(() => streamFromString(csv));

    const matches = (await knex.raw<Array<{ meet_name: string }>>(
      "SELECT meet_name FROM meets_fts WHERE meets_fts MATCH 'american*'",
    )) as unknown as Array<{ meet_name: string }>;
    const names = matches.map((row) => row.meet_name);
    expect(names).toContain("WRPF AMERICAN PRO");
  });

  it("replaces all rows on re-ingest", async () => {
    await ingest.ingestFromStream(() =>
      streamFromString(buildCsv([{ ...REQUIRED, Name: "Old Lifter" }])),
    );
    expect(Number((await knex("lifts").count<{ c: number }[]>({ c: "*" }))[0]?.c)).toBe(1);

    await ingest.ingestFromStream(() =>
      streamFromString(
        buildCsv([
          { ...REQUIRED, Name: "New A" },
          { ...REQUIRED, Name: "New B" },
        ]),
      ),
    );
    const names = await knex("lifters").pluck<string[]>("name");
    expect(names).toEqual(expect.arrayContaining(["New A", "New B"]));
    expect(names).not.toContain("Old Lifter");
  });

  it("records ingest_runs row with per-table counts", async () => {
    const csv = buildCsv([{ ...REQUIRED, Name: "Tracker" }]);
    await ingest.ingestFromStream(() => streamFromString(csv), {
      sourceLastModified: "Fri, 16 May 2026 00:00:00 GMT",
      byteSize: 1024,
    });

    const run = await knex("ingest_runs").orderBy("id", "desc").first<{
      status: string;
      lift_count: number;
      meet_count: number;
      lifter_count: number;
      federation_count: number;
      byte_size: number;
    }>();
    expect(run?.status).toBe("completed");
    expect(run?.lift_count).toBe(1);
    expect(run?.lifter_count).toBe(1);
    expect(run?.meet_count).toBe(1);
    expect(run?.federation_count).toBe(1);
    expect(Number(run?.byte_size)).toBe(1024);
  });

  it("exposes nameToSlug for downstream code", () => {
    expect(nameToSlug("John Haack")).toBe("johnhaack");
    expect(nameToSlug("Māris #1")).toBe("maris1");
  });
});
