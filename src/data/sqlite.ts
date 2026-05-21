import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

import type {
  Entry,
  FederationSummary,
  Lifter,
  Meet,
  MetricInt32Arrays,
  MetricUint32Arrays,
  RankMetric,
  WeightClassRecord,
} from "./types";

export const SQLITE_SNAPSHOT_FILENAME = "snapshot.sqlite";
export const SQLITE_SCHEMA_VERSION = 1;

export interface StoreMetadata {
  sourceLastModified: string | null;
  ingestedAt: string;
  rowCount: number;
  lifterCount: number;
  meetCount: number;
  federationCount: number;
  recordCount: number;
}

export interface SqliteSnapshotInput {
  lifters: Lifter[];
  meets: Meet[];
  entries: Entry[];
  bestEntryByLifter: MetricInt32Arrays;
  rankByMetric: MetricUint32Arrays;
  records: WeightClassRecord[];
  federations: FederationSummary[];
  sourceLastModified: string | null;
  builtAt: string;
}

const RANK_METRICS: RankMetric[] = [
  "dots",
  "wilks",
  "glossbrenner",
  "goodlift",
  "total",
  "squat",
  "bench",
  "deadlift",
];

const METRIC_FIELD: Record<RankMetric, keyof Entry> = {
  dots: "dots",
  wilks: "wilks",
  glossbrenner: "glossbrenner",
  goodlift: "goodlift",
  total: "totalKg",
  squat: "best3SquatKg",
  bench: "best3BenchKg",
  deadlift: "best3DeadliftKg",
};

export function openReadonlyDatabase(file: string): DatabaseSync {
  const db = new DatabaseSync(file, {
    readOnly: true,
    enableForeignKeyConstraints: false,
  });
  db.exec(`
    PRAGMA query_only = ON;
    PRAGMA foreign_keys = OFF;
    PRAGMA temp_store = MEMORY;
  `);
  return db;
}

export function createWritableDatabase(file: string): DatabaseSync {
  if (file !== ":memory:") fs.rmSync(file, { force: true });
  const db = new DatabaseSync(file, {
    enableForeignKeyConstraints: false,
  });
  db.exec(`
    PRAGMA journal_mode = OFF;
    PRAGMA synchronous = OFF;
    PRAGMA foreign_keys = OFF;
    PRAGMA temp_store = MEMORY;
    PRAGMA cache_size = -200000;
  `);
  createSchema(db);
  return db;
}

export function createSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE metadata (
      key TEXT PRIMARY KEY,
      value TEXT
    ) STRICT;

    CREATE TABLE lifters (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL
    ) STRICT;

    CREATE TABLE meets (
      id INTEGER PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      federation TEXT NOT NULL,
      federation_slug TEXT NOT NULL,
      parent_federation TEXT,
      parent_slug TEXT,
      date TEXT NOT NULL,
      meet_name TEXT NOT NULL,
      meet_country TEXT,
      meet_state TEXT,
      meet_town TEXT,
      ruleset TEXT,
      sanctioned INTEGER NOT NULL
    ) STRICT;

    CREATE TABLE entries (
      id INTEGER PRIMARY KEY,
      lifter_id INTEGER NOT NULL,
      meet_id INTEGER NOT NULL,
      sex TEXT,
      age REAL,
      age_class TEXT,
      division TEXT,
      lifter_country TEXT,
      lifter_state TEXT,
      event TEXT NOT NULL,
      equipment TEXT NOT NULL,
      tested INTEGER NOT NULL,
      bodyweight_kg REAL,
      weight_class_kg REAL,
      squat1_kg REAL,
      squat2_kg REAL,
      squat3_kg REAL,
      squat4_kg REAL,
      bench1_kg REAL,
      bench2_kg REAL,
      bench3_kg REAL,
      bench4_kg REAL,
      deadlift1_kg REAL,
      deadlift2_kg REAL,
      deadlift3_kg REAL,
      deadlift4_kg REAL,
      best3_squat_kg REAL,
      best3_bench_kg REAL,
      best3_deadlift_kg REAL,
      total_kg REAL,
      place_rank INTEGER,
      place_status TEXT,
      dots REAL,
      wilks REAL,
      glossbrenner REAL,
      goodlift REAL
    ) STRICT;

    CREATE TABLE rankings (
      metric TEXT NOT NULL,
      rank INTEGER NOT NULL,
      lifter_id INTEGER NOT NULL,
      entry_id INTEGER NOT NULL,
      value REAL NOT NULL,
      PRIMARY KEY (metric, rank)
    ) STRICT;

    CREATE TABLE records (
      category TEXT NOT NULL,
      sex TEXT NOT NULL,
      equipment_group TEXT NOT NULL,
      weight_class_kg REAL NOT NULL,
      rank INTEGER NOT NULL,
      entry_id INTEGER NOT NULL,
      lift_value REAL NOT NULL
    ) STRICT;

    CREATE TABLE federations (
      slug TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      parent_slug TEXT,
      meet_count INTEGER NOT NULL
    ) STRICT;
  `);
}

export function createIndexes(db: DatabaseSync): void {
  db.exec(`
    CREATE INDEX idx_lifters_username ON lifters(username);
    CREATE INDEX idx_lifters_name ON lifters(name);
    CREATE INDEX idx_meets_path ON meets(path);
    CREATE INDEX idx_meets_federation_slug_date ON meets(federation_slug, date DESC);
    CREATE INDEX idx_meets_date ON meets(date DESC);
    CREATE INDEX idx_entries_lifter_id ON entries(lifter_id);
    CREATE INDEX idx_entries_meet_id ON entries(meet_id);
    CREATE INDEX idx_entries_filter ON entries(equipment, sex, weight_class_kg, event, age_class);
    CREATE INDEX idx_entries_dots ON entries(dots);
    CREATE INDEX idx_entries_total ON entries(total_kg);
    CREATE INDEX idx_rankings_metric_rank ON rankings(metric, rank);
    CREATE INDEX idx_rankings_metric_lifter ON rankings(metric, lifter_id);
    CREATE INDEX idx_records_filter ON records(category, sex, equipment_group, weight_class_kg, rank);
  `);
}

export function insertSqliteSnapshot(db: DatabaseSync, input: SqliteSnapshotInput): void {
  db.exec("BEGIN");
  try {
    insertMetadata(db, input);
    insertLifters(db, input.lifters);
    insertMeets(db, input.meets);
    insertEntries(db, input.entries);
    insertRankings(db, input.entries, input.bestEntryByLifter, input.rankByMetric);
    insertRecords(db, input.records);
    insertFederations(db, input.federations);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  createIndexes(db);
  db.exec("ANALYZE");
}

export function readMetadata(db: DatabaseSync): StoreMetadata {
  const rows = db.prepare("SELECT key, value FROM metadata").all() as {
    key: string;
    value: string | null;
  }[];
  const values = new Map(rows.map((row) => [row.key, row.value]));
  return {
    sourceLastModified: values.get("sourceLastModified") ?? null,
    ingestedAt: required(values, "builtAt"),
    rowCount: intValue(values, "entries"),
    lifterCount: intValue(values, "lifters"),
    meetCount: intValue(values, "meets"),
    federationCount: intValue(values, "federations"),
    recordCount: intValue(values, "records"),
  };
}

function insertMetadata(db: DatabaseSync, input: SqliteSnapshotInput): void {
  const insert = db.prepare("INSERT INTO metadata (key, value) VALUES (?, ?)");
  insert.run("schemaVersion", String(SQLITE_SCHEMA_VERSION));
  insert.run("sourceLastModified", input.sourceLastModified);
  insert.run("builtAt", input.builtAt);
  insert.run("lifters", String(input.lifters.length));
  insert.run("meets", String(input.meets.length));
  insert.run("entries", String(input.entries.length));
  insert.run("federations", String(input.federations.length));
  insert.run("records", String(input.records.length));
}

function insertLifters(db: DatabaseSync, lifters: Lifter[]): void {
  const insert = db.prepare("INSERT INTO lifters (id, username, name) VALUES (?, ?, ?)");
  for (let id = 0; id < lifters.length; id++) {
    const lifter = lifters[id]!;
    insert.run(id, lifter.username, lifter.name);
  }
}

function insertMeets(db: DatabaseSync, meets: Meet[]): void {
  const insert = db.prepare(`
    INSERT INTO meets (
      id, path, federation, federation_slug, parent_federation, parent_slug, date, meet_name,
      meet_country, meet_state, meet_town, ruleset, sanctioned
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (let id = 0; id < meets.length; id++) {
    const meet = meets[id]!;
    insert.run(
      id,
      meet.path,
      meet.federation,
      slug(meet.federation),
      meet.parentFederation,
      meet.parentFederation == null ? null : slug(meet.parentFederation),
      meet.date,
      meet.meetName,
      meet.meetCountry,
      meet.meetState,
      meet.meetTown,
      meet.ruleset,
      boolValue(meet.sanctioned),
    );
  }
}

function insertEntries(db: DatabaseSync, entries: Entry[]): void {
  const insert = db.prepare(`
    INSERT INTO entries (
      id, lifter_id, meet_id, sex, age, age_class, division, lifter_country, lifter_state,
      event, equipment, tested, bodyweight_kg, weight_class_kg,
      squat1_kg, squat2_kg, squat3_kg, squat4_kg,
      bench1_kg, bench2_kg, bench3_kg, bench4_kg,
      deadlift1_kg, deadlift2_kg, deadlift3_kg, deadlift4_kg,
      best3_squat_kg, best3_bench_kg, best3_deadlift_kg, total_kg,
      place_rank, place_status, dots, wilks, glossbrenner, goodlift
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);
  for (let id = 0; id < entries.length; id++) {
    const entry = entries[id]!;
    insert.run(
      id,
      entry.lifterId,
      entry.meetId,
      entry.sex,
      entry.age,
      entry.ageClass,
      entry.division,
      entry.lifterCountry,
      entry.lifterState,
      entry.event,
      entry.equipment,
      boolValue(entry.tested),
      entry.bodyweightKg,
      entry.weightClassKg,
      entry.squat1Kg,
      entry.squat2Kg,
      entry.squat3Kg,
      entry.squat4Kg,
      entry.bench1Kg,
      entry.bench2Kg,
      entry.bench3Kg,
      entry.bench4Kg,
      entry.deadlift1Kg,
      entry.deadlift2Kg,
      entry.deadlift3Kg,
      entry.deadlift4Kg,
      entry.best3SquatKg,
      entry.best3BenchKg,
      entry.best3DeadliftKg,
      entry.totalKg,
      entry.placeRank,
      entry.placeStatus,
      entry.dots,
      entry.wilks,
      entry.glossbrenner,
      entry.goodlift,
    );
  }
}

function insertRankings(
  db: DatabaseSync,
  entries: Entry[],
  bestEntryByLifter: MetricInt32Arrays,
  rankByMetric: MetricUint32Arrays,
): void {
  const insert = db.prepare(
    "INSERT INTO rankings (metric, rank, lifter_id, entry_id, value) VALUES (?, ?, ?, ?, ?)",
  );
  for (const metric of RANK_METRICS) {
    const field = METRIC_FIELD[metric];
    const ranking = rankByMetric[metric];
    const bestForMetric = bestEntryByLifter[metric];
    for (let i = 0; i < ranking.length; i++) {
      const lifterId = ranking[i]!;
      const entryId = bestForMetric[lifterId]!;
      const value = entries[entryId]![field] as number | null;
      if (value == null) continue;
      insert.run(metric, i + 1, lifterId, entryId, value);
    }
  }
}

function insertRecords(db: DatabaseSync, records: WeightClassRecord[]): void {
  const insert = db.prepare(`
    INSERT INTO records (category, sex, equipment_group, weight_class_kg, rank, entry_id, lift_value)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const record of records) {
    insert.run(
      record.category,
      record.sex,
      record.equipmentGroup,
      record.weightClassKg,
      record.rank,
      record.entryId,
      record.liftValue,
    );
  }
}

function insertFederations(db: DatabaseSync, federations: FederationSummary[]): void {
  const insert = db.prepare(
    "INSERT INTO federations (slug, code, parent_slug, meet_count) VALUES (?, ?, ?, ?)",
  );
  for (const federation of federations) {
    insert.run(federation.slug, federation.code, federation.parentSlug, federation.meetCount);
  }
}

function boolValue(value: boolean): number {
  return value ? 1 : 0;
}

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function required(values: Map<string, string | null>, key: string): string {
  const value = values.get(key);
  if (value == null) throw new Error(`snapshot sqlite metadata missing ${key}`);
  return value;
}

function intValue(values: Map<string, string | null>, key: string): number {
  const value = parseInt(required(values, key), 10);
  if (!Number.isFinite(value)) throw new Error(`snapshot sqlite metadata ${key} is invalid`);
  return value;
}
