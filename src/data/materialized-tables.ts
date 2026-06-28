import type { Database as DatabaseType } from "better-sqlite3";

import type { Entry, EquipmentGroup, RankMetric, RecordCategory } from "./types";

type CountableTable = "federations" | "records";

interface CountRow {
  count: number;
}

const RANK_METRICS: ReadonlyArray<{ metric: RankMetric; field: string }> = [
  { metric: "dots", field: "dots" },
  { metric: "wilks", field: "wilks" },
  { metric: "glossbrenner", field: "glossbrenner" },
  { metric: "goodlift", field: "goodlift" },
  { metric: "total", field: "total_kg" },
  { metric: "squat", field: "best3_squat_kg" },
  { metric: "bench", field: "best3_bench_kg" },
  { metric: "deadlift", field: "best3_deadlift_kg" },
];

const RECORD_CATEGORIES: ReadonlyArray<{
  key: RecordCategory;
  field: string;
  events: ReadonlyArray<Entry["event"]>;
}> = [
  { key: "squat_full_power", field: "best3_squat_kg", events: ["SBD"] },
  { key: "squat_all_events", field: "best3_squat_kg", events: ["SBD", "S", "SB", "SD"] },
  { key: "bench_full_power", field: "best3_bench_kg", events: ["SBD"] },
  { key: "bench_all_events", field: "best3_bench_kg", events: ["SBD", "B", "SB", "BD"] },
  { key: "deadlift_full_power", field: "best3_deadlift_kg", events: ["SBD"] },
  { key: "deadlift_all_events", field: "best3_deadlift_kg", events: ["SBD", "D", "SD", "BD"] },
  { key: "total", field: "total_kg", events: ["SBD"] },
];

const EQUIPMENT_GROUPS: ReadonlyArray<{
  name: EquipmentGroup;
  condition: string;
}> = [
  { name: "raw", condition: "equipment = 'Raw'" },
  { name: "wraps", condition: "equipment = 'Wraps'" },
  { name: "single", condition: "equipment = 'Single-ply'" },
  { name: "multi", condition: "equipment = 'Multi-ply'" },
  { name: "unlimited", condition: "equipment = 'Unlimited'" },
  { name: "all-tested", condition: "tested = 1" },
];

export function createDerivedTables(db: DatabaseType): void {
  createFederationsTable(db);
  createLifterBestsTable(db);
  createRecordsTable(db);
}

function createFederationsTable(db: DatabaseType): void {
  db.exec(`
    CREATE TABLE federations AS
    SELECT
      federation_slug AS slug,
      MIN(federation) AS code,
      MIN(parent_federation_slug) AS parent_slug,
      COUNT(*) AS meet_count
    FROM meets
    WHERE federation_slug <> ''
    GROUP BY federation_slug
    ORDER BY meet_count DESC;

    CREATE UNIQUE INDEX idx_federations_slug ON federations(slug);
  `);
}

function createLifterBestsTable(db: DatabaseType): void {
  db.exec(`
    CREATE TABLE lifter_bests (
      metric TEXT NOT NULL,
      lifter_id INTEGER NOT NULL,
      entry_id INTEGER NOT NULL,
      value REAL NOT NULL,
      rank INTEGER NOT NULL,
      PRIMARY KEY (metric, lifter_id)
    );
  `);

  for (const { metric, field } of RANK_METRICS) {
    db.prepare(`
      INSERT INTO lifter_bests (metric, lifter_id, entry_id, value, rank)
      WITH best AS (
        SELECT
          lifter_id,
          id AS entry_id,
          ${field} AS value,
          ROW_NUMBER() OVER (
            PARTITION BY lifter_id
            ORDER BY ${field} DESC, id ASC
          ) AS lifter_rank
        FROM entries
        WHERE ${field} IS NOT NULL
      ),
      ranked AS (
        SELECT
          lifter_id,
          entry_id,
          value,
          ROW_NUMBER() OVER (ORDER BY value DESC, entry_id ASC) AS rank
        FROM best
        WHERE lifter_rank = 1
      )
      SELECT ?, lifter_id, entry_id, value, rank FROM ranked
    `).run(metric);
  }

  db.exec(`
    CREATE UNIQUE INDEX idx_lifter_bests_metric_rank ON lifter_bests(metric, rank);
    CREATE INDEX idx_lifter_bests_lifter ON lifter_bests(lifter_id);
  `);
}

function createRecordsTable(db: DatabaseType): void {
  db.exec(`
    CREATE TABLE records (
      category TEXT NOT NULL,
      sex TEXT NOT NULL,
      equipment_group TEXT NOT NULL,
      weight_class_kg REAL NOT NULL,
      rank INTEGER NOT NULL,
      entry_id INTEGER NOT NULL,
      lift_value REAL NOT NULL
    );
  `);

  for (const category of RECORD_CATEGORIES) {
    for (const equipmentGroup of EQUIPMENT_GROUPS) {
      for (const sex of ["M", "F"]) {
        const eventPlaceholders = category.events.map(() => "?").join(", ");
        db.prepare(`
          INSERT INTO records (
            category, sex, equipment_group, weight_class_kg, rank, entry_id, lift_value
          )
          WITH candidates AS (
            SELECT
              id AS entry_id,
              weight_class_kg,
              ${category.field} AS lift_value,
              ROW_NUMBER() OVER (
                PARTITION BY weight_class_kg
                ORDER BY ${category.field} DESC, id ASC
              ) AS rank
            FROM entries
            WHERE sex = ?
              AND event IN (${eventPlaceholders})
              AND weight_class_kg IS NOT NULL
              AND ${category.field} IS NOT NULL
              AND ${equipmentGroup.condition}
          )
          SELECT ?, ?, ?, weight_class_kg, rank, entry_id, lift_value
          FROM candidates
          WHERE rank <= 3
        `).run(sex, ...category.events, category.key, sex, equipmentGroup.name);
      }
    }
  }

  db.exec(
    "CREATE INDEX idx_records_filter ON records(category, sex, equipment_group, weight_class_kg)",
  );
}

export function countRows(db: DatabaseType, table: CountableTable): number {
  const row = db.prepare<[], CountRow>(`SELECT COUNT(*) AS count FROM ${table}`).get();
  if (row == null) {
    throw new Error(`Could not count rows in ${table}`);
  }
  return row.count;
}
