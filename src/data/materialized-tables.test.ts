import Database from "better-sqlite3";
import { describe, expect, it } from "vite-plus/test";

import { createDerivedTables } from "./materialized-tables";

const RECORD_METRICS = [
  { field: "best3_squat_kg", category: "squat_full_power" },
  { field: "best3_bench_kg", category: "bench_full_power" },
  { field: "best3_deadlift_kg", category: "deadlift_full_power" },
  { field: "total_kg", category: "total" },
];

function createRecordsDatabase(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE meets (
      federation_slug TEXT,
      federation TEXT,
      parent_federation_slug TEXT
    );
    CREATE TABLE lifters (
      id INTEGER PRIMARY KEY,
      username TEXT,
      name TEXT
    );
    CREATE TABLE entries (
      id INTEGER PRIMARY KEY,
      lifter_id INTEGER NOT NULL DEFAULT 1,
      sex TEXT NOT NULL DEFAULT 'M',
      age_class TEXT DEFAULT '24-34',
      equipment TEXT NOT NULL DEFAULT 'Raw',
      weight_class_kg REAL NOT NULL,
      weight_class_over INTEGER NOT NULL DEFAULT 0,
      event TEXT NOT NULL DEFAULT 'SBD',
      tested INTEGER NOT NULL DEFAULT 0,
      place_status TEXT,
      best3_squat_kg REAL,
      best3_bench_kg REAL,
      best3_deadlift_kg REAL,
      total_kg REAL,
      dots REAL,
      wilks REAL,
      glossbrenner REAL,
      goodlift REAL
    );
  `);
  return db;
}

describe("record materialization", () => {
  it.each(RECORD_METRICS)(
    "excludes unsuccessful $field values and ranks successful open and age-class records",
    ({ field, category }) => {
      const db = createRecordsDatabase();
      try {
        const insert = db.prepare(`
          INSERT INTO entries (weight_class_kg, ${field}, place_status)
          VALUES (?, ?, ?)
        `);
        for (const value of [null, -100, 0]) insert.run(70, value, "DQ");
        for (const value of [200, 300, 250]) insert.run(93, value, "DQ");

        createDerivedTables(db);

        const records = db
          .prepare(`
            SELECT age_class, weight_class_kg, rank, lift_value
            FROM records
            WHERE category = ? AND sex = 'M' AND equipment_group = 'raw'
            ORDER BY age_class, weight_class_kg, rank
          `)
          .all(category);
        expect(records).toEqual([
          { age_class: null, weight_class_kg: 93, rank: 1, lift_value: 300 },
          { age_class: null, weight_class_kg: 93, rank: 2, lift_value: 250 },
          { age_class: null, weight_class_kg: 93, rank: 3, lift_value: 200 },
          { age_class: "24-34", weight_class_kg: 93, rank: 1, lift_value: 300 },
          { age_class: "24-34", weight_class_kg: 93, rank: 2, lift_value: 250 },
          { age_class: "24-34", weight_class_kg: 93, rank: 3, lift_value: 200 },
        ]);
      } finally {
        db.close();
      }
    },
  );
});
