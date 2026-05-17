// Builds a small AppData from a handful of in-memory rows for tests. Goes
// through the same index builders the loader uses, so anything that
// changes the precomputed shape will fail here too.

import type { AppContext } from "../context";
import { createContext, resetContext } from "../context";
import {
  buildBestEntryByLifter,
  buildEntriesByLifter,
  buildEntriesByMeet,
  buildFederations,
  buildRankByMetric,
  buildRecords,
} from "../data/indexes";
import type { AppData, Entry, Lifter, Meet } from "../data/types";

// Five lifters competing at three meets across two federations. Enough
// variety to exercise top-N (rankings), top-3 per weight class (records),
// federation grouping, and per-lifter history.
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

// Returns an AppContext with the data store preloaded with the fixture.
// Resets the module-level context so each test gets a fresh singleton.
export function createTestContext(): AppContext {
  resetContext();
  const context = createContext();
  context.store.set(makeFixtureAppData());
  return context;
}

// Convenience: full Entry with sensible nulls everywhere we don't care
// about, so tests only set the fields they actually need.
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
