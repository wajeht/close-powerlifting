// Pure functions that build the precomputed indexes on AppData. Each takes
// the populated entity arrays and returns a fresh index structure. Run them
// in sequence after the streaming parse has finished filling
// `lifters` / `meets` / `entries`.

import type {
  AppData,
  Entry,
  EquipmentGroup,
  FederationSummary,
  MetricInt32Arrays,
  MetricUint32Arrays,
  RankMetric,
  RecordCategory,
  Sex,
  WeightClassRecord,
} from "./types";
import { nameToSlug } from "./normalize";

// Maps a RankMetric key to the Entry field it reads. Defining this once
// here keeps the bestEntry / sortedRank builders honest about which column
// each metric ranks on.
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

const RANK_METRICS: ReadonlyArray<RankMetric> = [
  "dots",
  "wilks",
  "glossbrenner",
  "goodlift",
  "total",
  "squat",
  "bench",
  "deadlift",
];

// entries grouped by lifter id / meet id. Both are O(N) one-pass builds.
export function buildEntriesByLifter(entries: Entry[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (let i = 0; i < entries.length; i++) {
    const lifterId = entries[i]!.lifterId;
    const list = map.get(lifterId);
    if (list == null) map.set(lifterId, [i]);
    else list.push(i);
  }
  return map;
}

export function buildEntriesByMeet(entries: Entry[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (let i = 0; i < entries.length; i++) {
    const meetId = entries[i]!.meetId;
    const list = map.get(meetId);
    if (list == null) map.set(meetId, [i]);
    else list.push(i);
  }
  return map;
}

// For each metric, the entry index of each lifter's best result on that
// metric. -1 = no eligible entry (lifter has no row with a non-null value
// in that column). One pass per metric; reuses entriesByLifter so we don't
// re-scan the whole entries array per lifter.
export function buildBestEntryByLifter(
  entries: Entry[],
  lifterCount: number,
  entriesByLifter: Map<number, number[]>,
): MetricInt32Arrays {
  const result = {} as MetricInt32Arrays;
  for (const metric of RANK_METRICS) {
    const field = METRIC_FIELD[metric];
    const out = new Int32Array(lifterCount).fill(-1);
    for (const [lifterId, entryIds] of entriesByLifter) {
      let bestIdx = -1;
      let bestVal = -Infinity;
      for (const entryId of entryIds) {
        const value = entries[entryId]![field] as number | null;
        if (value == null) continue;
        if (value > bestVal) {
          bestVal = value;
          bestIdx = entryId;
        }
      }
      out[lifterId] = bestIdx;
    }
    result[metric] = out;
  }
  return result;
}

// Lifter ids sorted DESC by their best value on each metric. Lifters with
// no eligible entry on a metric are excluded from that metric's index.
// Result: Uint32Array of lifter ids; top-N is `.subarray(0, N)`.
export function buildRankByMetric(
  entries: Entry[],
  lifterCount: number,
  bestEntryByLifter: MetricInt32Arrays,
): MetricUint32Arrays {
  const result = {} as MetricUint32Arrays;
  for (const metric of RANK_METRICS) {
    const field = METRIC_FIELD[metric];
    const bestForMetric = bestEntryByLifter[metric];

    // Collect eligible lifter ids first so we can size the typed array.
    const eligible: number[] = [];
    for (let lifterId = 0; lifterId < lifterCount; lifterId++) {
      if (bestForMetric[lifterId]! >= 0) eligible.push(lifterId);
    }

    // Sort by the metric value DESC. NaN can't appear (we excluded -1) but
    // null can — null values were filtered out by buildBestEntryByLifter.
    eligible.sort((a, b) => {
      const ea = entries[bestForMetric[a]!]![field] as number | null;
      const eb = entries[bestForMetric[b]!]![field] as number | null;
      // null-safety: best entries are guaranteed to have a value, but be defensive.
      const av = ea ?? -Infinity;
      const bv = eb ?? -Infinity;
      return bv - av;
    });

    result[metric] = Uint32Array.from(eligible);
  }
  return result;
}

// ----- Records: top-3 per (category, sex, equipmentGroup, weightClass) -----

interface CategoryConfig {
  key: RecordCategory;
  liftField: keyof Pick<Entry, "best3SquatKg" | "best3BenchKg" | "best3DeadliftKg" | "totalKg">;
  events: ReadonlyArray<Entry["event"]>;
}

const CATEGORIES: ReadonlyArray<CategoryConfig> = [
  { key: "squat_full_power", liftField: "best3SquatKg", events: ["SBD"] },
  { key: "squat_all_events", liftField: "best3SquatKg", events: ["SBD", "S", "SB", "SD"] },
  { key: "bench_full_power", liftField: "best3BenchKg", events: ["SBD"] },
  { key: "bench_all_events", liftField: "best3BenchKg", events: ["SBD", "B", "SB", "BD"] },
  { key: "deadlift_full_power", liftField: "best3DeadliftKg", events: ["SBD"] },
  {
    key: "deadlift_all_events",
    liftField: "best3DeadliftKg",
    events: ["SBD", "D", "SD", "BD"],
  },
  { key: "total", liftField: "totalKg", events: ["SBD"] },
];

interface EquipmentGroupConfig {
  name: EquipmentGroup;
  matches: (entry: Entry) => boolean;
}

const EQUIPMENT_GROUPS: ReadonlyArray<EquipmentGroupConfig> = [
  { name: "raw", matches: (e) => e.equipment === "Raw" },
  { name: "wraps", matches: (e) => e.equipment === "Wraps" },
  { name: "single", matches: (e) => e.equipment === "Single-ply" },
  { name: "multi", matches: (e) => e.equipment === "Multi-ply" },
  { name: "unlimited", matches: (e) => e.equipment === "Unlimited" },
  { name: "all-tested", matches: (e) => e.tested === true },
];

const SEXES: ReadonlyArray<Sex> = ["M", "F"];

const TOP_N_PER_CLASS = 3;

// Builds the top-3 records leaderboard. 7 × 6 × 2 = 84 buckets; each
// bucket is grouped by weight_class with top-3 per class.
export function buildRecords(entries: Entry[]): WeightClassRecord[] {
  const out: WeightClassRecord[] = [];

  for (const category of CATEGORIES) {
    const eventSet = new Set<string>(category.events);

    for (const equipmentGroup of EQUIPMENT_GROUPS) {
      for (const sex of SEXES) {
        // Group eligible entries by weight class.
        const byWeightClass = new Map<number, { entryId: number; value: number }[]>();
        for (let entryId = 0; entryId < entries.length; entryId++) {
          const entry = entries[entryId]!;
          if (entry.sex !== sex) continue;
          if (!eventSet.has(entry.event)) continue;
          if (!equipmentGroup.matches(entry)) continue;
          const value = entry[category.liftField];
          if (value == null) continue;
          const weightClass = entry.weightClassKg;
          if (weightClass == null) continue;

          const list = byWeightClass.get(weightClass);
          const row = { entryId, value };
          if (list == null) byWeightClass.set(weightClass, [row]);
          else list.push(row);
        }

        // Top-N per class.
        for (const [weightClassKg, rows] of byWeightClass) {
          rows.sort((a, b) => b.value - a.value);
          const top = rows.slice(0, TOP_N_PER_CLASS);
          for (let rank = 0; rank < top.length; rank++) {
            const r = top[rank]!;
            out.push({
              category: category.key,
              sex,
              equipmentGroup: equipmentGroup.name,
              weightClassKg,
              rank: rank + 1,
              entryId: r.entryId,
              liftValue: r.value,
            });
          }
        }
      }
    }
  }

  return out;
}

// ----- Federations index -----

export function buildFederations(meets: AppData["meets"]): {
  federations: FederationSummary[];
  meetsByFederation: Map<string, number[]>;
} {
  // Tally meets per federation code; remember parent code for each.
  const counts = new Map<string, { code: string; parent: string | null; meetIds: number[] }>();
  for (let meetId = 0; meetId < meets.length; meetId++) {
    const meet = meets[meetId]!;
    const slug = nameToSlug(meet.federation);
    if (slug.length === 0) continue;
    const existing = counts.get(slug);
    if (existing == null) {
      counts.set(slug, {
        code: meet.federation,
        parent: meet.parentFederation,
        meetIds: [meetId],
      });
    } else {
      existing.meetIds.push(meetId);
    }
  }

  const federations: FederationSummary[] = [];
  const meetsByFederation = new Map<string, number[]>();
  for (const [slug, info] of counts) {
    federations.push({
      slug,
      code: info.code,
      parentSlug: info.parent == null ? null : nameToSlug(info.parent) || null,
      meetCount: info.meetIds.length,
    });
    meetsByFederation.set(slug, info.meetIds);
  }
  federations.sort((a, b) => b.meetCount - a.meetCount);
  return { federations, meetsByFederation };
}
