import type { Knex } from "knex";

import type { DataStoreType } from "../../../data/database";
import type { Entry, EquipmentGroup, RecordCategory, Sex } from "../../../data/types";

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
  { name: "raw", condition: "e.equipment = 'Raw'" },
  { name: "wraps", condition: "e.equipment = 'Wraps'" },
  { name: "single", condition: "e.equipment = 'Single-ply'" },
  { name: "multi", condition: "e.equipment = 'Multi-ply'" },
  { name: "unlimited", condition: "e.equipment = 'Unlimited'" },
  { name: "all-tested", condition: "e.tested = 1" },
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

interface RecordRow {
  category: RecordCategory;
  sex: Sex;
  equipment_group: EquipmentGroup;
  weight_class_kg: number;
  rank: number;
  entry_id: number;
  lift_value: number;
  username: string;
  name: string;
  federation: string;
  meet_path: string;
  meet_name: string;
  date: string;
}

export function createRecordsService(store: DataStoreType) {
  async function groupRecords(filter: RecordsFilter) {
    const { db } = store.get();
    const rows =
      filter.ageClass == null
        ? await getPrecomputedRecords(db, filter)
        : await computeAgeFilteredRecords(db, filter);

    const byCategoryAndGroup = new Map<string, RecordRow[]>();
    for (const row of rows) {
      const key = `${row.category}::${row.sex}::${row.equipment_group}`;
      const list = byCategoryAndGroup.get(key);
      if (list == null) byCategoryAndGroup.set(key, [row]);
      else list.push(row);
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
          .map(([k, records]) => {
            const [, sex, equipmentGroup] = k.split("::");
            return {
              sex,
              equipment_group: equipmentGroup,
              records: records
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

async function getPrecomputedRecords(db: Knex, filter: RecordsFilter): Promise<RecordRow[]> {
  const query = db("records as r")
    .join("entries as e", "e.id", "r.entry_id")
    .join("lifters as l", "l.id", "e.lifter_id")
    .join("meets as m", "m.id", "e.meet_id")
    .select({
      category: "r.category",
      sex: "r.sex",
      equipment_group: "r.equipment_group",
      weight_class_kg: "r.weight_class_kg",
      rank: "r.rank",
      entry_id: "r.entry_id",
      lift_value: "r.lift_value",
      username: "l.username",
      name: "l.name",
      federation: "m.federation",
      meet_path: "m.path",
      meet_name: "m.meet_name",
      date: "m.date",
    });

  if (filter.equipmentGroup != null) query.where("r.equipment_group", filter.equipmentGroup);
  if (filter.sex != null) query.where("r.sex", filter.sex);
  if (filter.weightClassKg != null) query.where("r.weight_class_kg", filter.weightClassKg);

  return query.orderBy(["r.category", "r.sex", "r.equipment_group", "r.weight_class_kg", "r.rank"]);
}

async function computeAgeFilteredRecords(db: Knex, filter: RecordsFilter): Promise<RecordRow[]> {
  const sexes: Sex[] = filter.sex != null ? [filter.sex] : ["M", "F"];
  const equipmentGroups =
    filter.equipmentGroup != null
      ? EQUIPMENT_GROUPS.filter((group) => group.name === filter.equipmentGroup)
      : EQUIPMENT_GROUPS;

  const rows: RecordRow[] = [];
  for (const category of RECORD_CATEGORIES) {
    for (const equipmentGroup of equipmentGroups) {
      for (const sex of sexes) {
        const eventPlaceholders = category.events.map(() => "?").join(", ");
        const bindings: Knex.RawBinding[] = [filter.ageClass ?? "", sex, ...category.events];
        const where = [
          "e.age_class = ?",
          "e.sex = ?",
          `e.event IN (${eventPlaceholders})`,
          "e.weight_class_kg IS NOT NULL",
          `e.${category.field} IS NOT NULL`,
          equipmentGroup.condition,
        ];
        if (filter.weightClassKg != null) {
          where.push("e.weight_class_kg = ?");
          bindings.push(filter.weightClassKg);
        }
        bindings.push(category.key, sex, equipmentGroup.name);

        const result = await db.raw<RecordRow[]>(
          `
            WITH candidates AS (
              SELECT
                e.id AS entry_id,
                e.weight_class_kg,
                e.${category.field} AS lift_value,
                ROW_NUMBER() OVER (
                  PARTITION BY e.weight_class_kg
                  ORDER BY e.${category.field} DESC, e.id ASC
                ) AS rank
              FROM entries e
              WHERE ${where.join(" AND ")}
            )
            SELECT
              ? AS category,
              ? AS sex,
              ? AS equipment_group,
              c.weight_class_kg,
              c.rank,
              c.entry_id,
              c.lift_value,
              l.username,
              l.name,
              m.federation,
              m.path AS meet_path,
              m.meet_name,
              m.date
            FROM candidates c
            JOIN entries e ON e.id = c.entry_id
            JOIN lifters l ON l.id = e.lifter_id
            JOIN meets m ON m.id = e.meet_id
            WHERE c.rank <= 3
          `,
          bindings,
        );
        rows.push(...result);
      }
    }
  }

  return rows;
}

function formatRecord(row: RecordRow) {
  return {
    weight_class_kg: row.weight_class_kg,
    rank: row.rank,
    lift_value: row.lift_value,
    username: row.username,
    name: row.name,
    federation: row.federation,
    meet_path: row.meet_path,
    meet_name: row.meet_name,
    date: row.date,
  };
}
