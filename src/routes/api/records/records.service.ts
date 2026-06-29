import type { Knex } from "knex";

import type { DataStoreType } from "../../../data/database";
import { RECORD_CATEGORY_DEFINITIONS } from "../../../data/leaderboard-definitions";
import type { EquipmentGroup, RecordCategory, Sex } from "../../../data/types";

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
    const rows = await getPrecomputedRecords(db, filter);

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
      categories: RECORD_CATEGORY_DEFINITIONS.map((category) => ({
        key: category.key,
        title: category.title,
        sections: Array.from(byCategoryAndGroup.entries())
          .filter(([k]) => k.startsWith(`${category.key}::`))
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
  if (filter.ageClass == null) query.whereNull("r.age_class");
  else query.where("r.age_class", filter.ageClass);

  return query.orderBy(["r.category", "r.sex", "r.equipment_group", "r.weight_class_kg", "r.rank"]);
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
