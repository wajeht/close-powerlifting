// Data-model shapes. Mirrors OPL's Lifter/Meet/Entry from
// gitlab.com/openpowerlifting/opl-data — crates/db/src/data.rs.

export type Sex = "M" | "F" | "Mx";

export type Event = "SBD" | "BD" | "SD" | "SB" | "S" | "B" | "D";

export type Equipment = "Raw" | "Wraps" | "Single-ply" | "Multi-ply" | "Unlimited" | "Straps";

// OPL's `Place` enum split into rank + status. Numeric placings keep
// `placeRank`; non-finishing codes go to `placeStatus`. See
// crates/opltypes/src/place.rs.
export type PlaceStatus = "G" | "DQ" | "DD" | "NS";

export interface Lifter {
  // Deterministic ASCII slug — see Username::from_name in
  // crates/opltypes/src/username.rs. Used as /api/users/{username}.
  username: string;
  // As it appears in CSV, including any `#N` disambiguation suffix.
  name: string;
}

export interface Meet {
  // OPL's canonical URL slug ("wrpf/2024-05-12/wrpfamericanpro"), shipped
  // as the `MeetPath` column in the bulk CSV. Read directly, never
  // reconstructed.
  path: string;
  federation: string;
  parentFederation: string | null;
  date: string; // ISO 8601, YYYY-MM-DD
  meetName: string;
  meetCountry: string | null;
  meetState: string | null;
  meetTown: string | null;
  ruleset: string | null;
  sanctioned: boolean;
}

export interface Entry {
  // FKs into the lifters / meets tables or fixture arrays.
  lifterId: number;
  meetId: number;

  // Per-meet lifter attributes (can vary across entries for the same lifter).
  sex: Sex | null;
  age: number | null;
  ageClass: string | null;
  division: string | null;
  lifterCountry: string | null;
  lifterState: string | null;

  // Performance category.
  event: Event;
  equipment: Equipment;
  tested: boolean;

  bodyweightKg: number | null;
  // Negative values encode "under N" classes (e.g. -93 = "U93"). Stored verbatim.
  weightClassKg: number | null;

  // Attempts. Negative = failed attempt; null = no attempt.
  squat1Kg: number | null;
  squat2Kg: number | null;
  squat3Kg: number | null;
  squat4Kg: number | null;
  bench1Kg: number | null;
  bench2Kg: number | null;
  bench3Kg: number | null;
  bench4Kg: number | null;
  deadlift1Kg: number | null;
  deadlift2Kg: number | null;
  deadlift3Kg: number | null;
  deadlift4Kg: number | null;

  // Bests + total, precomputed by OPL.
  best3SquatKg: number | null;
  best3BenchKg: number | null;
  best3DeadliftKg: number | null;
  totalKg: number | null;

  // Outcome.
  placeRank: number | null;
  placeStatus: PlaceStatus | null;

  // Scoring formulae, all precomputed in the CSV.
  // (McCulloch is computed dynamically by OPL — not a column in the bulk CSV.)
  dots: number | null;
  wilks: number | null;
  glossbrenner: number | null;
  goodlift: number | null;
}

export type RecordCategory =
  | "squat_full_power"
  | "squat_all_events"
  | "bench_full_power"
  | "bench_all_events"
  | "deadlift_full_power"
  | "deadlift_all_events"
  | "total";

export type EquipmentGroup = "raw" | "wraps" | "single" | "multi" | "unlimited" | "all-tested";

// Ranking metric keys. Each maps to an Entry field and a SQLite ranking column.
export type RankMetric =
  | "dots"
  | "wilks"
  | "glossbrenner"
  | "goodlift"
  | "total"
  | "squat"
  | "bench"
  | "deadlift";
