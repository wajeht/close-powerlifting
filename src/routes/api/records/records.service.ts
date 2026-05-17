import type { DataStoreType } from "../../../data/store";
import type {
  AppData,
  Entry,
  EquipmentGroup,
  RecordCategory,
  Sex,
  WeightClassRecord,
} from "../../../data/types";

const CATEGORY_TITLES: Record<RecordCategory, string> = {
  squat_full_power: "Squat (Full Power)",
  squat_all_events: "Squat (All Events)",
  bench_full_power: "Bench (Full Power)",
  bench_all_events: "Bench (All Events)",
  deadlift_full_power: "Deadlift (Full Power)",
  deadlift_all_events: "Deadlift (All Events)",
  total: "Total",
};

const CATEGORY_ORDER: RecordCategory[] = [
  "squat_full_power",
  "squat_all_events",
  "bench_full_power",
  "bench_all_events",
  "deadlift_full_power",
  "deadlift_all_events",
  "total",
];

export const EQUIPMENT_GROUP_BY_QUERY: Record<string, EquipmentGroup> = {
  raw: "raw",
  wraps: "wraps",
  single: "single",
  multi: "multi",
  unlimited: "unlimited",
  "all-tested": "all-tested",
};

export const SEX_BY_QUERY: Record<string, Sex> = {
  men: "M",
  women: "F",
  M: "M",
  F: "F",
};

const REGEX_WEIGHT_CLASS = /^-?\d+(\.\d+)?$/;

export interface RecordsFilter {
  equipmentGroup?: EquipmentGroup;
  sex?: Sex;
  weightClassKg?: number;
  ageClass: string | null;
}

export function createRecordsService(store: DataStoreType) {
  function groupRecords(filter: RecordsFilter) {
    const data = store.get();
    const recs =
      filter.ageClass == null
        ? data.records.filter((rec) => matchesFilter(rec, filter))
        : computeAgeFilteredRecords(data, filter);

    const byCategoryAndGroup = new Map<string, WeightClassRecord[]>();
    for (const rec of recs) {
      const key = `${rec.category}::${rec.sex}::${rec.equipmentGroup}`;
      const list = byCategoryAndGroup.get(key);
      if (list == null) byCategoryAndGroup.set(key, [rec]);
      else list.push(rec);
    }

    return {
      filters: {
        equipment_group: filter.equipmentGroup ?? null,
        sex: filter.sex ?? null,
        weight_class_kg: filter.weightClassKg ?? null,
        age_class: filter.ageClass,
      },
      categories: CATEGORY_ORDER.map((key) => ({
        key,
        title: CATEGORY_TITLES[key],
        sections: Array.from(byCategoryAndGroup.entries())
          .filter(([k]) => k.startsWith(`${key}::`))
          .map(([k, rows]) => {
            const [, sex, equipmentGroup] = k.split("::");
            return {
              sex,
              equipment_group: equipmentGroup,
              records: rows
                .slice()
                .sort((a, b) => a.weightClassKg - b.weightClassKg || a.rank - b.rank)
                .map((rec) => formatRecord(data, rec)),
            };
          }),
      })),
    };
  }

  // Resolves a single ambiguous path segment ("men"/"women" or "75"/"82.5"
  // etc.) to either a sex filter or a weight class filter. Returns null for
  // anything that's neither.
  function resolveSexOrWeightClass(
    value: string,
  ): { kind: "sex"; value: Sex } | { kind: "weightClass"; value: number } | null {
    const sex = SEX_BY_QUERY[value];
    if (sex != null) return { kind: "sex", value: sex };
    if (REGEX_WEIGHT_CLASS.test(value)) return { kind: "weightClass", value: parseFloat(value) };
    return null;
  }

  return { groupRecords, resolveSexOrWeightClass };
}

function matchesFilter(rec: WeightClassRecord, filter: RecordsFilter): boolean {
  if (filter.equipmentGroup != null && rec.equipmentGroup !== filter.equipmentGroup) return false;
  if (filter.sex != null && rec.sex !== filter.sex) return false;
  if (filter.weightClassKg != null && rec.weightClassKg !== filter.weightClassKg) return false;
  return true;
}

// Slow path: filter raw entries by ageClass then recompute top-3 per
// (category, sex, equipmentGroup, weightClass). Used only when ageClass is
// in the query — the precomputed table doesn't include that dimension.
function computeAgeFilteredRecords(data: AppData, filter: RecordsFilter): WeightClassRecord[] {
  const sexes: Sex[] = filter.sex != null ? [filter.sex] : ["M", "F"];
  const equipmentGroups: EquipmentGroup[] =
    filter.equipmentGroup != null
      ? [filter.equipmentGroup]
      : ["raw", "wraps", "single", "multi", "unlimited", "all-tested"];

  interface Bucket {
    category: RecordCategory;
    sex: Sex;
    equipmentGroup: EquipmentGroup;
    weightClassKg: number;
    rows: { entryId: number; value: number }[];
  }
  const buckets = new Map<string, Bucket>();

  const categories: {
    key: RecordCategory;
    field: keyof Entry;
    events: ReadonlyArray<Entry["event"]>;
  }[] = [
    { key: "squat_full_power", field: "best3SquatKg", events: ["SBD"] },
    { key: "squat_all_events", field: "best3SquatKg", events: ["SBD", "S", "SB", "SD"] },
    { key: "bench_full_power", field: "best3BenchKg", events: ["SBD"] },
    { key: "bench_all_events", field: "best3BenchKg", events: ["SBD", "B", "SB", "BD"] },
    { key: "deadlift_full_power", field: "best3DeadliftKg", events: ["SBD"] },
    { key: "deadlift_all_events", field: "best3DeadliftKg", events: ["SBD", "D", "SD", "BD"] },
    { key: "total", field: "totalKg", events: ["SBD"] },
  ];

  for (let entryId = 0; entryId < data.entries.length; entryId++) {
    const entry = data.entries[entryId]!;
    if (entry.ageClass !== filter.ageClass) continue;
    if (!sexes.includes(entry.sex as Sex)) continue;
    if (filter.weightClassKg != null && entry.weightClassKg !== filter.weightClassKg) continue;

    const wc = entry.weightClassKg;
    if (wc == null) continue;

    for (const eg of equipmentGroups) {
      const isAllTested = eg === "all-tested";
      if (isAllTested ? !entry.tested : entry.equipment !== equipmentGroupToEquipment(eg)) {
        continue;
      }
      for (const cat of categories) {
        if (!cat.events.includes(entry.event)) continue;
        const value = entry[cat.field] as number | null;
        if (value == null) continue;
        const key = `${cat.key}::${entry.sex}::${eg}::${wc}`;
        let bucket = buckets.get(key);
        if (bucket == null) {
          bucket = {
            category: cat.key,
            sex: entry.sex as Sex,
            equipmentGroup: eg,
            weightClassKg: wc,
            rows: [],
          };
          buckets.set(key, bucket);
        }
        bucket.rows.push({ entryId, value });
      }
    }
  }

  const out: WeightClassRecord[] = [];
  for (const b of buckets.values()) {
    b.rows.sort((x, y) => y.value - x.value);
    const top = b.rows.slice(0, 3);
    for (let rank = 0; rank < top.length; rank++) {
      out.push({
        category: b.category,
        sex: b.sex,
        equipmentGroup: b.equipmentGroup,
        weightClassKg: b.weightClassKg,
        rank: rank + 1,
        entryId: top[rank]!.entryId,
        liftValue: top[rank]!.value,
      });
    }
  }
  return out;
}

function equipmentGroupToEquipment(eg: EquipmentGroup): string | null {
  if (eg === "raw") return "Raw";
  if (eg === "wraps") return "Wraps";
  if (eg === "single") return "Single-ply";
  if (eg === "multi") return "Multi-ply";
  if (eg === "unlimited") return "Unlimited";
  return null;
}

function formatRecord(data: AppData, rec: WeightClassRecord) {
  const entry = data.entries[rec.entryId]!;
  const lifter = data.lifters[entry.lifterId]!;
  const meet = data.meets[entry.meetId]!;
  return {
    weight_class_kg: rec.weightClassKg,
    rank: rec.rank,
    lift_value: rec.liftValue,
    username: lifter.username,
    name: lifter.name,
    federation: meet.federation,
    meet_path: meet.path,
    meet_name: meet.meetName,
    date: meet.date,
  };
}
