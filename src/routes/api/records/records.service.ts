import type { DatabaseSync, SQLInputValue } from "node:sqlite";

import type { DataStoreType } from "../../../data/store";
import type {
  EquipmentGroup,
  Event as PowerliftingEvent,
  RecordCategory,
  Sex,
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

interface DisplayRecord {
  category: RecordCategory;
  sex: Sex;
  equipment_group: EquipmentGroup;
  weight_class_kg: number;
  rank: number;
  lift_value: number;
  username: string;
  name: string;
  federation: string;
  meet_path: string;
  meet_name: string;
  date: string;
}

interface AgeEntryRow {
  id: number;
  sex: Sex;
  event: PowerliftingEvent;
  equipment: string;
  tested: number;
  weight_class_kg: number | null;
  best3_squat_kg: number | null;
  best3_bench_kg: number | null;
  best3_deadlift_kg: number | null;
  total_kg: number | null;
  username: string;
  name: string;
  federation: string;
  meet_path: string;
  meet_name: string;
  date: string;
}

export function createRecordsService(store: DataStoreType) {
  function groupRecords(filter: RecordsFilter) {
    const db = store.get();
    const recs =
      filter.ageClass == null
        ? queryPrecomputedRecords(db, filter)
        : computeAgeFilteredRecords(db, filter);

    const byCategoryAndGroup = new Map<string, DisplayRecord[]>();
    for (const rec of recs) {
      const key = `${rec.category}::${rec.sex}::${rec.equipment_group}`;
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
                .sort((a, b) => a.weight_class_kg - b.weight_class_kg || a.rank - b.rank)
                .map(formatRecord),
            };
          }),
      })),
    };
  }

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

function queryPrecomputedRecords(db: DatabaseSync, filter: RecordsFilter): DisplayRecord[] {
  const clauses: string[] = [];
  const params: SQLInputValue[] = [];
  if (filter.equipmentGroup != null) {
    clauses.push("r.equipment_group = ?");
    params.push(filter.equipmentGroup);
  }
  if (filter.sex != null) {
    clauses.push("r.sex = ?");
    params.push(filter.sex);
  }
  if (filter.weightClassKg != null) {
    clauses.push("r.weight_class_kg = ?");
    params.push(filter.weightClassKg);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  return db
    .prepare(
      `
      SELECT
        r.category,
        r.sex,
        r.equipment_group,
        r.weight_class_kg,
        r.rank,
        r.lift_value,
        l.username,
        l.name,
        m.federation,
        m.path AS meet_path,
        m.meet_name,
        m.date
      FROM records r
      JOIN entries e ON e.id = r.entry_id
      JOIN lifters l ON l.id = e.lifter_id
      JOIN meets m ON m.id = e.meet_id
      ${where}
    `,
    )
    .all(...params) as unknown as DisplayRecord[];
}

function computeAgeFilteredRecords(db: DatabaseSync, filter: RecordsFilter): DisplayRecord[] {
  const clauses = ["e.age_class = ?"];
  const params: SQLInputValue[] = [filter.ageClass];
  if (filter.sex != null) {
    clauses.push("e.sex = ?");
    params.push(filter.sex);
  }
  if (filter.weightClassKg != null) {
    clauses.push("e.weight_class_kg = ?");
    params.push(filter.weightClassKg);
  }

  const rows = db
    .prepare(
      `
      SELECT
        e.id,
        e.sex,
        e.event,
        e.equipment,
        e.tested,
        e.weight_class_kg,
        e.best3_squat_kg,
        e.best3_bench_kg,
        e.best3_deadlift_kg,
        e.total_kg,
        l.username,
        l.name,
        m.federation,
        m.path AS meet_path,
        m.meet_name,
        m.date
      FROM entries e
      JOIN lifters l ON l.id = e.lifter_id
      JOIN meets m ON m.id = e.meet_id
      WHERE ${clauses.join(" AND ")}
    `,
    )
    .all(...params) as unknown as AgeEntryRow[];

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
    rows: { entry: AgeEntryRow; value: number }[];
  }

  const buckets = new Map<string, Bucket>();
  for (const entry of rows) {
    if (!sexes.includes(entry.sex)) continue;
    const weightClass = entry.weight_class_kg;
    if (weightClass == null) continue;
    for (const equipmentGroup of equipmentGroups) {
      if (!matchesEquipmentGroup(entry, equipmentGroup)) continue;
      for (const category of CATEGORIES) {
        if (!category.events.includes(entry.event)) continue;
        const value = entry[category.field];
        if (value == null) continue;
        const key = `${category.key}::${entry.sex}::${equipmentGroup}::${weightClass}`;
        let bucket = buckets.get(key);
        if (bucket == null) {
          bucket = {
            category: category.key,
            sex: entry.sex,
            equipmentGroup,
            weightClassKg: weightClass,
            rows: [],
          };
          buckets.set(key, bucket);
        }
        bucket.rows.push({ entry, value });
      }
    }
  }

  const out: DisplayRecord[] = [];
  for (const bucket of buckets.values()) {
    bucket.rows.sort((a, b) => b.value - a.value);
    for (let i = 0; i < Math.min(3, bucket.rows.length); i++) {
      const row = bucket.rows[i]!;
      out.push({
        category: bucket.category,
        sex: bucket.sex,
        equipment_group: bucket.equipmentGroup,
        weight_class_kg: bucket.weightClassKg,
        rank: i + 1,
        lift_value: row.value,
        username: row.entry.username,
        name: row.entry.name,
        federation: row.entry.federation,
        meet_path: row.entry.meet_path,
        meet_name: row.entry.meet_name,
        date: row.entry.date,
      });
    }
  }
  return out;
}

const CATEGORIES: Array<{
  key: RecordCategory;
  field: "best3_squat_kg" | "best3_bench_kg" | "best3_deadlift_kg" | "total_kg";
  events: PowerliftingEvent[];
}> = [
  { key: "squat_full_power", field: "best3_squat_kg", events: ["SBD"] },
  { key: "squat_all_events", field: "best3_squat_kg", events: ["SBD", "S", "SB", "SD"] },
  { key: "bench_full_power", field: "best3_bench_kg", events: ["SBD"] },
  { key: "bench_all_events", field: "best3_bench_kg", events: ["SBD", "B", "SB", "BD"] },
  { key: "deadlift_full_power", field: "best3_deadlift_kg", events: ["SBD"] },
  { key: "deadlift_all_events", field: "best3_deadlift_kg", events: ["SBD", "D", "SD", "BD"] },
  { key: "total", field: "total_kg", events: ["SBD"] },
];

function matchesEquipmentGroup(entry: AgeEntryRow, equipmentGroup: EquipmentGroup): boolean {
  if (equipmentGroup === "all-tested") return entry.tested === 1;
  return entry.equipment === equipmentGroupToEquipment(equipmentGroup);
}

function equipmentGroupToEquipment(equipmentGroup: EquipmentGroup): string | null {
  if (equipmentGroup === "raw") return "Raw";
  if (equipmentGroup === "wraps") return "Wraps";
  if (equipmentGroup === "single") return "Single-ply";
  if (equipmentGroup === "multi") return "Multi-ply";
  if (equipmentGroup === "unlimited") return "Unlimited";
  return null;
}

function formatRecord(rec: DisplayRecord) {
  return {
    weight_class_kg: rec.weight_class_kg,
    rank: rec.rank,
    lift_value: rec.lift_value,
    username: rec.username,
    name: rec.name,
    federation: rec.federation,
    meet_path: rec.meet_path,
    meet_name: rec.meet_name,
    date: rec.date,
  };
}
