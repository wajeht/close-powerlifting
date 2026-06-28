import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";

import type { AppContext } from "../context";
import { createContext, resetContext } from "../context";
import { createDatabaseClient, type SnapshotMetadata } from "../data/database";
import {
  buildBestEntryByLifter,
  buildEntriesByLifter,
  buildEntriesByMeet,
  buildFederations,
  buildRankByMetric,
  buildRecords,
} from "../data/store";
import type { AppData, Entry, Lifter, Meet } from "../data/types";

const METRIC_FIELD = {
  dots: "dots",
  wilks: "wilks",
  glossbrenner: "glossbrenner",
  goodlift: "goodlift",
  total: "totalKg",
  squat: "best3SquatKg",
  bench: "best3BenchKg",
  deadlift: "best3DeadliftKg",
} as const;

export function makeFixtureAppData(): AppData {
  const lifters: Lifter[] = [
    { username: "edcoan", name: "Ed Coan" },
    { username: "johnsmith1", name: "John Smith #1" },
    { username: "marisrazmanis", name: "Māris Rāzmanis" },
    { username: "kristyhawkins", name: "Kristy Hawkins" },
    { username: "ruthrabbitt", name: "Ruth Rabbitt" },
  ];

  const meets: Meet[] = [
    {
      path: "wrpf/2024-05-12/wrpfamericanpro",
      federation: "WRPF",
      parentFederation: null,
      date: "2024-05-12",
      meetName: "WRPF AMERICAN PRO",
      meetCountry: "USA",
      meetState: "CA",
      meetTown: null,
      ruleset: null,
      sanctioned: true,
    },
    {
      path: "usapl/2024-09-01/rawpro",
      federation: "USAPL",
      parentFederation: "IPF",
      date: "2024-09-01",
      meetName: "Raw Pro",
      meetCountry: "USA",
      meetState: "TX",
      meetTown: "Austin",
      ruleset: null,
      sanctioned: true,
    },
    {
      path: "ipf/2023-11-15/worldchampionships",
      federation: "IPF",
      parentFederation: null,
      date: "2023-11-15",
      meetName: "World Championships",
      meetCountry: "Sweden",
      meetState: null,
      meetTown: "Stockholm",
      ruleset: null,
      sanctioned: true,
    },
  ];

  const entries: Entry[] = [
    makeEntry({
      lifterId: 0,
      meetId: 0,
      sex: "M",
      event: "SBD",
      equipment: "Raw",
      bodyweightKg: 99.5,
      weightClassKg: 100,
      best3SquatKg: 410,
      best3BenchKg: 270,
      best3DeadliftKg: 400,
      totalKg: 1080,
      placeRank: 1,
      dots: 700.0,
      wilks: 680.0,
    }),
    makeEntry({
      lifterId: 0,
      meetId: 1,
      sex: "M",
      event: "SBD",
      equipment: "Raw",
      bodyweightKg: 100,
      weightClassKg: 100,
      best3SquatKg: 400,
      best3BenchKg: 260,
      best3DeadliftKg: 395,
      totalKg: 1055,
      placeRank: 2,
      dots: 685.0,
      wilks: 670.0,
    }),
    makeEntry({
      lifterId: 1,
      meetId: 0,
      sex: "M",
      event: "SBD",
      equipment: "Single-ply",
      bodyweightKg: 90,
      weightClassKg: 90,
      best3SquatKg: 360,
      best3BenchKg: 250,
      best3DeadliftKg: 360,
      totalKg: 970,
      placeRank: 1,
      dots: 640.0,
      wilks: 625.0,
    }),
    makeEntry({
      lifterId: 2,
      meetId: 2,
      sex: "M",
      event: "SBD",
      equipment: "Raw",
      bodyweightKg: 92,
      weightClassKg: 93,
      best3SquatKg: 365,
      best3BenchKg: 220,
      best3DeadliftKg: 380,
      totalKg: 965,
      placeRank: 1,
      dots: 632.5,
      wilks: 615.0,
    }),
    makeEntry({
      lifterId: 3,
      meetId: 1,
      sex: "F",
      event: "SBD",
      equipment: "Raw",
      bodyweightKg: 74.5,
      weightClassKg: 75,
      best3SquatKg: 232.5,
      best3BenchKg: 130,
      best3DeadliftKg: 245,
      totalKg: 607.5,
      placeRank: 1,
      dots: 612.3,
      wilks: 600.0,
    }),
    makeEntry({
      lifterId: 4,
      meetId: 2,
      sex: "F",
      event: "SBD",
      equipment: "Raw",
      bodyweightKg: 60,
      weightClassKg: 60,
      tested: true,
      best3SquatKg: 200,
      best3BenchKg: 110,
      best3DeadliftKg: 220,
      totalKg: 530,
      placeRank: 1,
      dots: 590.0,
      wilks: 575.0,
    }),
  ];

  const lifterByUsername = new Map<string, number>();
  for (let i = 0; i < lifters.length; i++) lifterByUsername.set(lifters[i]!.username, i);
  const meetByPath = new Map<string, number>();
  for (let i = 0; i < meets.length; i++) meetByPath.set(meets[i]!.path, i);

  const entriesByLifter = buildEntriesByLifter(entries);
  const entriesByMeet = buildEntriesByMeet(entries);
  const bestEntryByLifter = buildBestEntryByLifter(entries, lifters.length, entriesByLifter);
  const rankByMetric = buildRankByMetric(entries, lifters.length, bestEntryByLifter);
  const records = buildRecords(entries);
  const { federations, meetsByFederation } = buildFederations(meets);

  return {
    lifters,
    meets,
    entries,
    lifterByUsername,
    meetByPath,
    entriesByLifter,
    entriesByMeet,
    bestEntryByLifter,
    rankByMetric,
    records,
    federations,
    meetsByFederation,
    sourceLastModified: "Mon, 01 Jan 2024 00:00:00 GMT",
    ingestedAt: "2024-01-01T00:00:00.000Z",
    rowCount: entries.length,
  };
}

export function createTestContext(): AppContext {
  resetContext();
  const context = createContext();
  const data = makeFixtureAppData();
  const databaseFile = writeFixtureDatabase(data);
  context.store.set({
    db: createDatabaseClient(databaseFile, false),
    metadata: {
      schemaVersion: 1,
      sourceLastModified: data.sourceLastModified,
      builtAt: data.ingestedAt,
      lifters: data.lifters.length,
      meets: data.meets.length,
      entries: data.entries.length,
      federations: data.federations.length,
      records: data.records.length,
    },
  });
  return context;
}

function writeFixtureDatabase(data: AppData): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "close-powerlifting-test-"));
  const file = path.join(dir, "fixture.sqlite");
  const db = new Database(file);
  try {
    createFixtureSchema(db);
    insertFixtureData(db, data);
  } finally {
    db.close();
  }
  return file;
}

function createFixtureSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE lifters (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL
    );

    CREATE TABLE meets (
      id INTEGER PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      federation TEXT NOT NULL,
      federation_slug TEXT NOT NULL,
      parent_federation TEXT,
      parent_federation_slug TEXT,
      date TEXT NOT NULL,
      meet_name TEXT NOT NULL,
      meet_country TEXT,
      meet_state TEXT,
      meet_town TEXT,
      ruleset TEXT,
      sanctioned INTEGER NOT NULL
    );

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
    );

    CREATE TABLE federations (
      slug TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      parent_slug TEXT,
      meet_count INTEGER NOT NULL
    );

    CREATE TABLE lifter_bests (
      metric TEXT NOT NULL,
      lifter_id INTEGER NOT NULL,
      entry_id INTEGER NOT NULL,
      value REAL NOT NULL,
      rank INTEGER NOT NULL,
      PRIMARY KEY (metric, lifter_id)
    );

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
}

function insertFixtureData(db: Database.Database, data: AppData): void {
  db.exec("BEGIN");
  try {
    insertMetadata(db, {
      schemaVersion: 1,
      sourceLastModified: data.sourceLastModified,
      builtAt: data.ingestedAt,
      lifters: data.lifters.length,
      meets: data.meets.length,
      entries: data.entries.length,
      federations: data.federations.length,
      records: data.records.length,
    });
    insertLifters(db, data.lifters);
    insertMeets(db, data.meets);
    insertEntries(db, data.entries);
    insertFederations(db, data);
    insertLifterBests(db, data);
    insertRecords(db, data);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function insertMetadata(db: Database.Database, metadata: SnapshotMetadata): void {
  const insert = db.prepare("INSERT INTO metadata (key, value) VALUES (?, ?)");
  insert.run("schema_version", String(metadata.schemaVersion));
  insert.run("source_last_modified", metadata.sourceLastModified ?? "");
  insert.run("built_at", metadata.builtAt);
  insert.run("lifters", String(metadata.lifters));
  insert.run("meets", String(metadata.meets));
  insert.run("entries", String(metadata.entries));
  insert.run("federations", String(metadata.federations));
  insert.run("records", String(metadata.records));
}

function insertLifters(db: Database.Database, lifters: Lifter[]): void {
  const insert = db.prepare("INSERT INTO lifters (id, username, name) VALUES (?, ?, ?)");
  for (let i = 0; i < lifters.length; i++) {
    const lifter = lifters[i]!;
    insert.run(i, lifter.username, lifter.name);
  }
}

function insertMeets(db: Database.Database, meets: Meet[]): void {
  const insert = db.prepare(`
    INSERT INTO meets (
      id, path, federation, federation_slug, parent_federation, parent_federation_slug,
      date, meet_name, meet_country, meet_state, meet_town, ruleset, sanctioned
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (let i = 0; i < meets.length; i++) {
    const meet = meets[i]!;
    insert.run(
      i,
      meet.path,
      meet.federation,
      meet.federation.toLowerCase().replace(/[^a-z0-9]/g, ""),
      meet.parentFederation,
      meet.parentFederation?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? null,
      meet.date,
      meet.meetName,
      meet.meetCountry,
      meet.meetState,
      meet.meetTown,
      meet.ruleset,
      meet.sanctioned ? 1 : 0,
    );
  }
}

function insertEntries(db: Database.Database, entries: Entry[]): void {
  const insert = db.prepare(`
    INSERT INTO entries (
      id, lifter_id, meet_id, sex, age, age_class, division, lifter_country, lifter_state,
      event, equipment, tested, bodyweight_kg, weight_class_kg,
      squat1_kg, squat2_kg, squat3_kg, squat4_kg,
      bench1_kg, bench2_kg, bench3_kg, bench4_kg,
      deadlift1_kg, deadlift2_kg, deadlift3_kg, deadlift4_kg,
      best3_squat_kg, best3_bench_kg, best3_deadlift_kg, total_kg,
      place_rank, place_status, dots, wilks, glossbrenner, goodlift
    )
    VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
  `);
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    insert.run(
      i,
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
      entry.tested ? 1 : 0,
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

function insertFederations(db: Database.Database, data: AppData): void {
  const insert = db.prepare(
    "INSERT INTO federations (slug, code, parent_slug, meet_count) VALUES (?, ?, ?, ?)",
  );
  for (const federation of data.federations) {
    insert.run(federation.slug, federation.code, federation.parentSlug, federation.meetCount);
  }
}

function insertLifterBests(db: Database.Database, data: AppData): void {
  const insert = db.prepare(
    "INSERT INTO lifter_bests (metric, lifter_id, entry_id, value, rank) VALUES (?, ?, ?, ?, ?)",
  );
  for (const metric of Object.keys(METRIC_FIELD) as Array<keyof typeof METRIC_FIELD>) {
    const ranked = data.rankByMetric[metric];
    const best = data.bestEntryByLifter[metric];
    const field = METRIC_FIELD[metric];
    for (let rank = 0; rank < ranked.length; rank++) {
      const lifterId = ranked[rank]!;
      const entryId = best[lifterId]!;
      const entry = data.entries[entryId]!;
      insert.run(metric, lifterId, entryId, entry[field], rank + 1);
    }
  }
}

function insertRecords(db: Database.Database, data: AppData): void {
  const insert = db.prepare(`
    INSERT INTO records (
      category, sex, equipment_group, weight_class_kg, rank, entry_id, lift_value
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const record of data.records) {
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

function makeEntry(overrides: Partial<Entry> & { lifterId: number; meetId: number }): Entry {
  return {
    sex: null,
    age: null,
    ageClass: null,
    division: null,
    lifterCountry: null,
    lifterState: null,
    event: "SBD",
    equipment: "Raw",
    tested: false,
    bodyweightKg: null,
    weightClassKg: null,
    squat1Kg: null,
    squat2Kg: null,
    squat3Kg: null,
    squat4Kg: null,
    bench1Kg: null,
    bench2Kg: null,
    bench3Kg: null,
    bench4Kg: null,
    deadlift1Kg: null,
    deadlift2Kg: null,
    deadlift3Kg: null,
    deadlift4Kg: null,
    best3SquatKg: null,
    best3BenchKg: null,
    best3DeadliftKg: null,
    totalKg: null,
    placeRank: null,
    placeStatus: null,
    dots: null,
    wilks: null,
    glossbrenner: null,
    goodlift: null,
    ...overrides,
  };
}
