import { Readable } from "node:stream";
import { describe, expect, beforeEach, it } from "vite-plus/test";

import { knex, logger } from "../tests/test-setup";
import { createIngestService } from "./ingest";

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

describe("ingest", () => {
  const ingest = createIngestService(knex, logger);

  beforeEach(async () => {
    await knex("lifts").delete();
    await knex("ingest_runs").delete();
    await knex.raw("INSERT INTO lifts_fts(lifts_fts) VALUES('rebuild')");
  });

  it("ingests CSV rows into lifts table", async () => {
    const csv = buildCsv([
      {
        Name: "John Haack",
        Sex: "M",
        Event: "SBD",
        Equipment: "Raw",
        TotalKg: 1005,
        Date: "2024-05-12",
        MeetName: "WRPF AMERICAN PRO",
        Federation: "WRPF",
      },
      {
        Name: "Jane Doe",
        Sex: "F",
        Event: "SBD",
        Equipment: "Raw",
        TotalKg: 500,
        Date: "2024-06-01",
        MeetName: "USAPL Nationals",
        Federation: "USAPL",
      },
    ]);

    const result = await ingest.ingestFromStream(streamFromString(csv));

    expect(result.status).toBe("completed");
    expect(result.rowCount).toBe(2);

    const count = await knex("lifts").count<{ c: number }[]>({ c: "*" });
    expect(Number(count[0]?.c)).toBe(2);
  });

  it("preserves negative attempts as failures", async () => {
    const csv = buildCsv([
      {
        Name: "Test Lifter",
        Sex: "M",
        Equipment: "Raw",
        Squat1Kg: 250,
        Squat2Kg: 270,
        Squat3Kg: -290,
        Best3SquatKg: 270,
        Date: "2024-01-01",
        MeetName: "Test Meet",
      },
    ]);

    await ingest.ingestFromStream(streamFromString(csv));

    const row = await knex("lifts").first<{
      squat1_kg: number;
      squat2_kg: number;
      squat3_kg: number;
      best3_squat_kg: number;
    }>();
    expect(row?.squat1_kg).toBe(250);
    expect(row?.squat2_kg).toBe(270);
    expect(row?.squat3_kg).toBe(-290);
    expect(row?.best3_squat_kg).toBe(270);
  });

  it("stores empty cells as NULL", async () => {
    const csv = buildCsv([
      {
        Name: "Sparse Lifter",
        Sex: "M",
        Date: "2024-03-15",
      },
    ]);

    await ingest.ingestFromStream(streamFromString(csv));

    const row = await knex("lifts").first<{
      event: string | null;
      equipment: string | null;
      total_kg: number | null;
      country: string | null;
    }>();
    expect(row?.event).toBeNull();
    expect(row?.equipment).toBeNull();
    expect(row?.total_kg).toBeNull();
    expect(row?.country).toBeNull();
  });

  it("preserves disambiguation suffix in name", async () => {
    const csv = buildCsv([
      { Name: "John Smith #1", Sex: "M", Date: "2024-01-01" },
      { Name: "John Smith #2", Sex: "M", Date: "2024-02-01" },
    ]);

    await ingest.ingestFromStream(streamFromString(csv));

    const rows = await knex("lifts").select<{ name: string }[]>("name").orderBy("date");
    expect(rows.map((r) => r.name)).toEqual(["John Smith #1", "John Smith #2"]);
  });

  it("skips rows missing required fields", async () => {
    const csv = buildCsv([
      { Name: "Valid Lifter", Date: "2024-01-01" },
      { Name: "", Date: "2024-01-02" },
      { Name: "No Date", Date: "" },
    ]);

    const result = await ingest.ingestFromStream(streamFromString(csv));
    expect(result.rowCount).toBe(1);

    const rows = await knex("lifts").select<{ name: string }[]>("name");
    expect(rows.map((r) => r.name)).toEqual(["Valid Lifter"]);
  });

  it("rebuilds FTS index and supports name search", async () => {
    const csv = buildCsv([
      { Name: "Jonathan Cayco", Sex: "M", Date: "2024-01-01", MeetName: "USAPL Raw Nationals" },
      { Name: "Kristy Hawkins", Sex: "F", Date: "2024-01-02", MeetName: "WRPF American Pro" },
      { Name: "John Haack", Sex: "M", Date: "2024-01-03", MeetName: "WRPF American Pro" },
    ]);

    await ingest.ingestFromStream(streamFromString(csv));

    const jonMatches = await knex.raw<{ name: string }[]>(
      `SELECT name FROM lifts_fts WHERE lifts_fts MATCH 'jon*' ORDER BY name`,
    );
    expect((jonMatches as unknown as { name: string }[]).map((row) => row.name)).toContain(
      "Jonathan Cayco",
    );

    const wrpfMatches = await knex.raw<{ name: string }[]>(
      `SELECT name FROM lifts_fts WHERE lifts_fts MATCH 'wrpf' ORDER BY name`,
    );
    const wrpfNames = (wrpfMatches as unknown as { name: string }[]).map((row) => row.name);
    expect(wrpfNames).toContain("John Haack");
    expect(wrpfNames).toContain("Kristy Hawkins");
  });

  it("replaces existing rows on re-ingest", async () => {
    await ingest.ingestFromStream(
      streamFromString(buildCsv([{ Name: "Old Lifter", Date: "2024-01-01" }])),
    );

    let count = await knex("lifts").count<{ c: number }[]>({ c: "*" });
    expect(Number(count[0]?.c)).toBe(1);

    await ingest.ingestFromStream(
      streamFromString(
        buildCsv([
          { Name: "New Lifter A", Date: "2024-02-01" },
          { Name: "New Lifter B", Date: "2024-02-02" },
        ]),
      ),
    );

    count = await knex("lifts").count<{ c: number }[]>({ c: "*" });
    expect(Number(count[0]?.c)).toBe(2);

    const names = await knex("lifts").pluck<string[]>("name");
    expect(names).toEqual(expect.arrayContaining(["New Lifter A", "New Lifter B"]));
    expect(names).not.toContain("Old Lifter");
  });

  it("records ingest_runs row with metadata", async () => {
    const csv = buildCsv([{ Name: "Tracker", Date: "2024-01-01" }]);

    await ingest.ingestFromStream(streamFromString(csv), {
      sourceLastModified: "Fri, 16 May 2026 00:00:00 GMT",
      byteSize: 1024,
    });

    const run = await knex("ingest_runs").orderBy("id", "desc").first<{
      status: string;
      row_count: number;
      byte_size: number;
      source_last_modified: string;
    }>();
    expect(run?.status).toBe("completed");
    expect(run?.row_count).toBe(1);
    expect(Number(run?.byte_size)).toBe(1024);
    expect(run?.source_last_modified).toBe("Fri, 16 May 2026 00:00:00 GMT");
  });
});
