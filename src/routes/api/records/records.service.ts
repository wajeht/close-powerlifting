import type { Knex } from "knex";

import { NotFoundError, ValidationError } from "../../../error";
import type { RecordCategory, ApiResponse } from "../../../types";
import {
  recordsEquipmentEnum,
  recordsWeightClassEnum,
  recordsSexEnum,
  type GetRecordsType,
  type GetFilteredRecordsParamType,
  type GetFilteredRecordsQueryType,
} from "./records.validation";

const TOP_N_PER_CLASS = 3;

const EQUIPMENT_MAP: Record<string, string[] | "tested"> = {
  raw: ["Raw"],
  wraps: ["Wraps"],
  single: ["Single-ply"],
  multi: ["Multi-ply"],
  unlimited: ["Unlimited"],
  "all-tested": "tested",
};

const SEX_MAP: Record<string, string> = {
  men: "M",
  women: "F",
};

interface CategoryConfig {
  // Stable id stored in `weight_class_records.category` by the ingest. Lets
  // the fast path join the materialized rows back to a human-readable title
  // without a second lookup table.
  key: string;
  title: string;
  liftColumn: "best3_squat_kg" | "best3_bench_kg" | "best3_deadlift_kg" | "total_kg";
  events: string[];
  liftKey: "squat" | "bench" | "deadlift" | "total";
}

const CATEGORIES: CategoryConfig[] = [
  {
    key: "squat_full_power",
    title: "Squat (Full Power)",
    liftColumn: "best3_squat_kg",
    events: ["SBD"],
    liftKey: "squat",
  },
  {
    key: "squat_all_events",
    title: "Squat (All Events)",
    liftColumn: "best3_squat_kg",
    events: ["SBD", "S", "SB", "SD"],
    liftKey: "squat",
  },
  {
    key: "bench_full_power",
    title: "Bench (Full Power)",
    liftColumn: "best3_bench_kg",
    events: ["SBD"],
    liftKey: "bench",
  },
  {
    key: "bench_all_events",
    title: "Bench (All Events)",
    liftColumn: "best3_bench_kg",
    events: ["SBD", "B", "SB", "BD"],
    liftKey: "bench",
  },
  {
    key: "deadlift_full_power",
    title: "Deadlift (Full Power)",
    liftColumn: "best3_deadlift_kg",
    events: ["SBD"],
    liftKey: "deadlift",
  },
  {
    key: "deadlift_all_events",
    title: "Deadlift (All Events)",
    liftColumn: "best3_deadlift_kg",
    events: ["SBD", "D", "SD", "BD"],
    liftKey: "deadlift",
  },
  {
    key: "total",
    title: "Total",
    liftColumn: "total_kg",
    events: ["SBD"],
    liftKey: "total",
  },
];

interface RecordsFilters {
  equipment?: string;
  sex?: string;
  ageClass?: string;
}

interface RankedLiftRow {
  weight_class_kg: number | null;
  name: string;
  lift_value: number | null;
  date: string;
  federation: string | null;
  rn: number;
}

function applyFilters(
  query: Knex.QueryBuilder,
  filters: RecordsFilters,
  liftColumn: string,
  events: string[],
): Knex.QueryBuilder {
  query = query
    .whereIn("lifts.event", events)
    .whereNotNull(`lifts.${liftColumn}`)
    .whereNotNull("lifts.weight_class_kg");

  if (filters.equipment) {
    const mapped = EQUIPMENT_MAP[filters.equipment];
    if (mapped === "tested") {
      query = query.where("lifts.tested", 1);
    } else if (mapped) {
      query = query.whereIn("lifts.equipment", mapped);
    }
  }

  if (filters.sex) {
    const mapped = SEX_MAP[filters.sex];
    if (mapped) query = query.where("lifters.sex", mapped);
  }

  if (filters.ageClass) {
    query = query.where("lifts.age_class", filters.ageClass);
  }

  return query;
}

function formatRecord(row: RankedLiftRow, category: CategoryConfig): Record<string, string> {
  const lift = row.lift_value == null ? "" : String(row.lift_value);
  return {
    class: row.rn === 1 && row.weight_class_kg != null ? String(row.weight_class_kg) : "",
    rank: String(row.rn),
    lifter: row.name,
    [category.liftKey]: lift,
    date: row.date,
    fed: row.federation ?? "",
  };
}

// Maps the API equipment slug to the equipment_group value stored in
// weight_class_records. Returns null if the slug doesn't have a precomputed
// bucket — keeps the fast path strictly opt-in.
function equipmentGroupKey(equipment: string | undefined): string | null {
  if (!equipment) return "raw";
  if (EQUIPMENT_MAP[equipment] == null) return null;
  return equipment;
}

export function createRecordService(knex: Knex) {
  // Fast path: served by weight_class_records (populated at ingest time).
  // Replaces 7 window queries over hundreds of thousands of lifts each with
  // one indexed scan over ~5k rows + a 50-row join. Used when no
  // `age_class` filter is set — age_class isn't part of the precomputed
  // shape, so its presence forces the slow path.
  async function queryRecordsFromMaterialized(filters: RecordsFilters): Promise<RecordCategory[]> {
    const sexKey = filters.sex && SEX_MAP[filters.sex] ? SEX_MAP[filters.sex] : "M";
    const equipmentGroup = equipmentGroupKey(filters.equipment);
    if (equipmentGroup == null) {
      throw new Error(`unsupported equipment filter for materialized path: ${filters.equipment}`);
    }

    const rows = (await knex("weight_class_records as wcr")
      .join("lifts", "lifts.id", "wcr.lift_id")
      .join("lifters", "lifters.id", "lifts.lifter_id")
      .join("meets", "meets.id", "lifts.meet_id")
      .join("federations", "federations.id", "meets.federation_id")
      .where("wcr.sex", sexKey)
      .andWhere("wcr.equipment_group", equipmentGroup)
      .orderBy([
        { column: "wcr.category", order: "asc" },
        { column: "wcr.weight_class_kg", order: "asc" },
        { column: "wcr.rank", order: "asc" },
      ])
      .select(
        knex.ref("wcr.category").as("category"),
        knex.ref("wcr.weight_class_kg").as("weight_class_kg"),
        knex.ref("wcr.rank").as("rn"),
        knex.ref("wcr.lift_value").as("lift_value"),
        knex.ref("lifters.name").as("name"),
        knex.ref("meets.date").as("date"),
        knex.ref("federations.code").as("federation"),
      )) as Array<RankedLiftRow & { category: string }>;

    const byCategory = new Map<string, RankedLiftRow[]>();
    for (const row of rows) {
      const list = byCategory.get(row.category);
      if (list == null) byCategory.set(row.category, [row]);
      else list.push(row);
    }

    return CATEGORIES.map((category) => ({
      title: category.title,
      records: (byCategory.get(category.key) ?? []).map((row) => formatRecord(row, category)),
    }));
  }

  async function queryCategory(
    category: CategoryConfig,
    filters: RecordsFilters,
  ): Promise<RankedLiftRow[]> {
    const inner = applyFilters(
      knex("lifts")
        .join("lifters", "lifters.id", "lifts.lifter_id")
        .join("meets", "meets.id", "lifts.meet_id")
        .join("federations", "federations.id", "meets.federation_id")
        .select(
          "lifts.weight_class_kg",
          knex.ref("lifters.name").as("name"),
          knex.raw("?? as lift_value", [`lifts.${category.liftColumn}`]),
          knex.ref("meets.date").as("date"),
          knex.ref("federations.code").as("federation"),
          knex.raw(
            `ROW_NUMBER() OVER (PARTITION BY lifts.weight_class_kg ORDER BY lifts.${category.liftColumn} DESC) AS rn`,
          ),
        ),
      filters,
      category.liftColumn,
      category.events,
    );

    return (await knex
      .select<RankedLiftRow[]>("*")
      .from(inner.as("ranked"))
      .where("rn", "<=", TOP_N_PER_CLASS)
      .orderBy([
        { column: "weight_class_kg", order: "asc" },
        { column: "rn", order: "asc" },
      ])) as RankedLiftRow[];
  }

  async function queryRecords(filters: RecordsFilters): Promise<RecordCategory[]> {
    // age_class doesn't have a precomputed bucket — fall back to the slow
    // window-function path. Every other (equipment, sex) combo is served
    // by weight_class_records directly.
    if (!filters.ageClass && equipmentGroupKey(filters.equipment) != null) {
      return queryRecordsFromMaterialized(filters);
    }

    const categories = await Promise.all(
      CATEGORIES.map(async (category) => {
        const rows = await queryCategory(category, filters);
        return {
          title: category.title,
          records: rows.map((row) => formatRecord(row, category)),
        };
      }),
    );
    return categories;
  }

  async function getRecords(options: GetRecordsType): Promise<ApiResponse<RecordCategory[]>> {
    const data = await queryRecords({
      equipment: "raw",
      sex: "men",
      ageClass: options.age_class,
    });
    return { data };
  }

  function validateEquipment(equipment: string): GetFilteredRecordsParamType["equipment"] {
    const result = recordsEquipmentEnum.safeParse(equipment);
    if (!result.success) {
      throw new ValidationError("Invalid equipment parameter!");
    }
    return result.data;
  }

  function parseSexOrWeightClass(
    equipment: string,
    sexOrWeightClass: string,
  ): GetFilteredRecordsParamType {
    const validEquipment = validateEquipment(equipment);

    const sexResult = recordsSexEnum.safeParse(sexOrWeightClass);
    if (sexResult.success) {
      return { equipment: validEquipment, sex: sexResult.data };
    }

    const weightClassResult = recordsWeightClassEnum.safeParse(sexOrWeightClass);
    if (weightClassResult.success) {
      return { equipment: validEquipment, weight_class: weightClassResult.data };
    }

    throw new NotFoundError("Invalid sex or weight class parameter!");
  }

  async function getFilteredRecords(
    filters: GetFilteredRecordsParamType,
    query: GetFilteredRecordsQueryType,
  ): Promise<ApiResponse<RecordCategory[]>> {
    const data = await queryRecords({
      equipment: filters.equipment ?? "raw",
      sex: filters.sex ?? "men",
      ageClass: query.age_class,
    });
    return { data };
  }

  return {
    getRecords,
    getFilteredRecords,
    parseSexOrWeightClass,
  };
}
