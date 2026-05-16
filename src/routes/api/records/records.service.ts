import type { Knex } from "knex";

import type { ScraperType } from "../../../context";
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
  title: string;
  liftColumn: "best3_squat_kg" | "best3_bench_kg" | "best3_deadlift_kg" | "total_kg";
  events: string[];
  liftKey: "squat" | "bench" | "deadlift" | "total";
}

const CATEGORIES: CategoryConfig[] = [
  {
    title: "Squat (Full Power)",
    liftColumn: "best3_squat_kg",
    events: ["SBD"],
    liftKey: "squat",
  },
  {
    title: "Squat (All Events)",
    liftColumn: "best3_squat_kg",
    events: ["SBD", "S", "SB", "SD"],
    liftKey: "squat",
  },
  {
    title: "Bench (Full Power)",
    liftColumn: "best3_bench_kg",
    events: ["SBD"],
    liftKey: "bench",
  },
  {
    title: "Bench (All Events)",
    liftColumn: "best3_bench_kg",
    events: ["SBD", "B", "SB", "BD"],
    liftKey: "bench",
  },
  {
    title: "Deadlift (Full Power)",
    liftColumn: "best3_deadlift_kg",
    events: ["SBD"],
    liftKey: "deadlift",
  },
  {
    title: "Deadlift (All Events)",
    liftColumn: "best3_deadlift_kg",
    events: ["SBD", "D", "SD", "BD"],
    liftKey: "deadlift",
  },
  {
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
  query = query.whereIn("event", events).whereNotNull(liftColumn).whereNotNull("weight_class_kg");

  if (filters.equipment) {
    const mapped = EQUIPMENT_MAP[filters.equipment];
    if (mapped === "tested") {
      query = query.where("tested", "Yes");
    } else if (mapped) {
      query = query.whereIn("equipment", mapped);
    }
  }

  if (filters.sex) {
    const mapped = SEX_MAP[filters.sex];
    if (mapped) query = query.where("sex", mapped);
  }

  if (filters.ageClass) {
    query = query.where("age_class", filters.ageClass);
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

export function createRecordService(knex: Knex, _scraper: ScraperType) {
  async function queryCategory(
    category: CategoryConfig,
    filters: RecordsFilters,
  ): Promise<RankedLiftRow[]> {
    const inner = applyFilters(
      knex("lifts").select(
        "weight_class_kg",
        "name",
        knex.raw("?? as lift_value", [category.liftColumn]),
        "date",
        "federation",
        knex.raw(
          `ROW_NUMBER() OVER (PARTITION BY weight_class_kg ORDER BY ${category.liftColumn} DESC) AS rn`,
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

  function parseRecordsCacheKey(key: string): { filterPath: string } | null {
    if (key !== "records" && !key.startsWith("records/")) return null;
    return { filterPath: key === "records" ? "" : key.slice("records".length) };
  }

  async function refreshCacheKey(key: string): Promise<boolean> {
    const parsed = parseRecordsCacheKey(key);
    if (!parsed) return false;
    // Records now served from lifts table; legacy cache keys are claimed
    // without re-scraping.
    return true;
  }

  return {
    parseRecordsCacheKey,
    getRecords,
    getFilteredRecords,
    parseSexOrWeightClass,
    refreshCacheKey,
  };
}
