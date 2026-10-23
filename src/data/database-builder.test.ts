import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { REQUIRED_COLUMNS, type ColumnName } from "./csv-normalization";
import { DATABASE_FILE_NAME, DATABASE_SCHEMA_VERSION } from "./database-files";

let snapshotDirectory: string | undefined;

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.doUnmock("./database-files");
  vi.doUnmock("unzipper");
  vi.resetModules();
  if (snapshotDirectory != null) {
    await fs.rm(snapshotDirectory, { recursive: true, force: true });
    snapshotDirectory = undefined;
  }
});

function buildCsv(rows: Array<Partial<Record<ColumnName, string>>>): string {
  const defaults: Partial<Record<ColumnName, string>> = {
    Name: "山田太郎",
    Sex: "F",
    Event: "SBD",
    Equipment: "Raw",
    Age: "30",
    AgeClass: "24-34",
    BodyweightKg: "83",
    WeightClassKg: "84",
    Best3SquatKg: "200",
    Best3BenchKg: "100",
    Best3DeadliftKg: "220",
    TotalKg: "520",
    Dots: "400",
    Place: "1",
    Tested: "Yes",
    Federation: "IPF",
    Date: "2024-05-12",
    MeetName: "Example Meet",
    Sanctioned: "Yes",
  };
  const lines = [REQUIRED_COLUMNS.join(",")];
  for (const overrides of rows) {
    const row = { ...defaults, ...overrides };
    const values = [];
    for (const column of REQUIRED_COLUMNS) {
      values.push(row[column] ?? "");
    }
    lines.push(values.join(","));
  }
  return `${lines.join("\n")}\n`;
}

describe("buildDatabase", () => {
  it("builds a snapshot with stable athletes, distinct weight classes, and valid records", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "close-powerlifting-builder-"));
    snapshotDirectory = directory;
    const databaseFile = path.join(directory, DATABASE_FILE_NAME);
    const csv = buildCsv([
      {},
      {
        Date: "2025-05-12",
        BodyweightKg: "90",
        WeightClassKg: "84+",
        Best3SquatKg: "250",
        TotalKg: "570",
        Dots: "450",
      },
      {
        Name: "Failed Lifter",
        Best3SquatKg: "-150",
        Best3BenchKg: "-75",
        Best3DeadliftKg: "-175",
        TotalKg: "",
        Dots: "",
        Place: "DQ",
      },
    ]);
    vi.doMock("./database-files", async () => {
      const actual = await vi.importActual<typeof import("./database-files")>("./database-files");
      return { ...actual, SNAPSHOT_DIR: directory, DATABASE_FILE: databaseFile };
    });
    vi.doMock("unzipper", () => ({
      default: {
        Open: {
          file: vi.fn(async () => ({
            files: [
              {
                path: "openpowerlifting.csv",
                type: "File",
                stream: () => Readable.from([csv]),
              },
            ],
          })),
        },
      },
    }));
    const fetchSnapshot = vi.fn(
      async () =>
        new Response("mock archive", {
          headers: { "last-modified": "Mon, 12 May 2025 00:00:00 GMT" },
        }),
    );
    vi.stubGlobal("fetch", fetchSnapshot);
    const { buildDatabase } = await import("./database-builder");

    await buildDatabase({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      box: vi.fn(),
      setLevel: vi.fn(),
    });

    const db = new Database(databaseFile, { readonly: true });
    try {
      expect(fetchSnapshot).toHaveBeenCalledOnce();
      expect(DATABASE_SCHEMA_VERSION).toBe(4);
      expect(db.pragma("user_version", { simple: true })).toBe(4);
      expect(db.prepare("SELECT value FROM metadata WHERE key = 'schema_version'").get()).toEqual({
        value: "4",
      });
      expect(
        db
          .prepare(
            "SELECT key, value FROM metadata WHERE key IN ('lifters', 'meets', 'entries') ORDER BY key",
          )
          .all(),
      ).toEqual([
        { key: "entries", value: "3" },
        { key: "lifters", value: "2" },
        { key: "meets", value: "2" },
      ]);
      expect(db.prepare("SELECT name, username FROM lifters ORDER BY id").all()).toEqual([
        { name: "山田太郎", username: expect.stringMatching(/^anon-[a-f0-9]{64}$/) },
        { name: "Failed Lifter", username: "failedlifter" },
      ]);
      expect(
        db
          .prepare(`
        SELECT lifter_id, weight_class_kg, weight_class_over, bodyweight_kg, best3_squat_kg, dots
        FROM entries WHERE lifter_id = 1 ORDER BY id
      `)
          .all(),
      ).toEqual([
        {
          lifter_id: 1,
          weight_class_kg: 84,
          weight_class_over: 0,
          bodyweight_kg: 83,
          best3_squat_kg: 200,
          dots: 400,
        },
        {
          lifter_id: 1,
          weight_class_kg: 84,
          weight_class_over: 1,
          bodyweight_kg: 90,
          best3_squat_kg: 250,
          dots: 450,
        },
      ]);
      expect(
        db
          .prepare(`
        SELECT weight_class_kg, weight_class_over, rank
        FROM ranking_filter_bests
        WHERE metric = 'dots' AND equipment_key = 'raw' AND sex_key = 'women'
          AND weight_class_kg = 84 AND age_class IS NULL
        ORDER BY weight_class_over
      `)
          .all(),
      ).toEqual([
        { weight_class_kg: 84, weight_class_over: 0, rank: 1 },
        { weight_class_kg: 84, weight_class_over: 1, rank: 1 },
      ]);
      expect(
        db
          .prepare(`
        SELECT weight_class_kg, weight_class_over, rank, lift_value
        FROM records
        WHERE category = 'squat_full_power' AND sex = 'F' AND equipment_group = 'raw'
          AND age_class IS NULL
        ORDER BY weight_class_over
      `)
          .all(),
      ).toEqual([
        { weight_class_kg: 84, weight_class_over: 0, rank: 1, lift_value: 200 },
        { weight_class_kg: 84, weight_class_over: 1, rank: 1, lift_value: 250 },
      ]);
      expect(
        db
          .prepare("SELECT COUNT(*) AS count FROM records WHERE lift_value <= 0 OR entry_id = 3")
          .get(),
      ).toEqual({ count: 0 });
      expect(await fs.readdir(directory)).toEqual([DATABASE_FILE_NAME]);
    } finally {
      db.close();
    }
  });
});
