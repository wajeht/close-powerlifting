import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import type {
  AppData,
  Entry,
  EquipmentGroup,
  RecordCategory,
  Sex,
  WeightClassRecord,
} from "../../../data/types";
import { sendSuccess } from "../api.helpers";
import {
  getRecordsByEquipmentParamValidation,
  getRecordsBySexOrWeightClassParamValidation,
  getRecordsByWeightClassSexParamValidation,
  getRecordsQueryValidation,
} from "./records.validation";

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

// Maps the precomputed equipmentGroup keys onto the spec's equipment enum.
// Note: the spec's "all-tested" maps to our "all-tested" 1:1.
const EQUIPMENT_GROUP_BY_QUERY: Record<string, EquipmentGroup> = {
  raw: "raw",
  wraps: "wraps",
  single: "single",
  multi: "multi",
  unlimited: "unlimited",
  "all-tested": "all-tested",
};

const SEX_BY_QUERY: Record<string, Sex> = {
  men: "M",
  women: "F",
  M: "M",
  F: "F",
};

const REGEX_WEIGHT_CLASS = /^-?\d+(\.\d+)?$/;

export function createRecordsRouter(context: AppContext) {
  const router = express.Router();

  /**
   * GET /api/records
   * @summary Get all powerlifting records
   * @tags Records
   */
  router.get("/api/records", (req: Request, res: Response) => {
    const data = context.store.get();
    const { age_class } = getRecordsQueryValidation.parse(req.query);
    sendSuccess(res, groupRecords(data, { ageClass: age_class ?? null }), {
      requestUrl: req.originalUrl,
    });
  });

  /**
   * GET /api/records/{equipment}/{weight_class}/{sex}
   * @summary Get records filtered by equipment, weight class system, and sex
   * @tags Records
   */
  router.get("/api/records/:equipment/:weight_class/:sex", (req: Request, res: Response) => {
    const data = context.store.get();
    const { equipment, sex } = getRecordsByWeightClassSexParamValidation.parse(req.params);
    const { age_class } = getRecordsQueryValidation.parse(req.query);
    // weight_class param is the *class system* selector (expanded / ipf / etc).
    // For our in-memory store we already group by the raw weightClassKg value,
    // so the selector is informational; we surface it back in the payload.
    sendSuccess(
      res,
      groupRecords(data, {
        equipmentGroup: EQUIPMENT_GROUP_BY_QUERY[equipment],
        sex: SEX_BY_QUERY[sex],
        ageClass: age_class ?? null,
      }),
      { requestUrl: req.originalUrl },
    );
  });

  /**
   * GET /api/records/{equipment}/{sex_or_weight_class}
   * @summary Get records filtered by equipment and (sex or weight class)
   * @tags Records
   */
  router.get("/api/records/:equipment/:sex_or_weight_class", (req: Request, res: Response) => {
    const data = context.store.get();
    const { equipment, sex_or_weight_class } = getRecordsBySexOrWeightClassParamValidation.parse(
      req.params,
    );
    const { age_class } = getRecordsQueryValidation.parse(req.query);
    const equipmentGroup = EQUIPMENT_GROUP_BY_QUERY[equipment];

    const sexValue = SEX_BY_QUERY[sex_or_weight_class];
    if (sexValue != null) {
      sendSuccess(
        res,
        groupRecords(data, { equipmentGroup, sex: sexValue, ageClass: age_class ?? null }),
        { requestUrl: req.originalUrl },
      );
      return;
    }
    if (REGEX_WEIGHT_CLASS.test(sex_or_weight_class)) {
      const weightClassKg = parseFloat(sex_or_weight_class);
      sendSuccess(
        res,
        groupRecords(data, { equipmentGroup, weightClassKg, ageClass: age_class ?? null }),
        { requestUrl: req.originalUrl },
      );
      return;
    }
    sendSuccess(res, groupRecords(data, { equipmentGroup, ageClass: age_class ?? null }), {
      requestUrl: req.originalUrl,
    });
  });

  /**
   * GET /api/records/{equipment}
   * @summary Get records filtered by equipment type
   * @tags Records
   */
  router.get("/api/records/:equipment", (req: Request, res: Response) => {
    const data = context.store.get();
    const { equipment } = getRecordsByEquipmentParamValidation.parse(req.params);
    const { age_class } = getRecordsQueryValidation.parse(req.query);
    sendSuccess(
      res,
      groupRecords(data, {
        equipmentGroup: EQUIPMENT_GROUP_BY_QUERY[equipment],
        ageClass: age_class ?? null,
      }),
      { requestUrl: req.originalUrl },
    );
  });

  return router;
}

interface RecordsFilter {
  equipmentGroup?: EquipmentGroup;
  sex?: Sex;
  weightClassKg?: number;
  ageClass: string | null;
}

function groupRecords(data: AppData, filter: RecordsFilter) {
  // Fast path: when no age_class filter, walk the precomputed records table.
  // Slow path: rebuild from entries to honor age_class. ~3.9M entries; ~100ms.
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

function matchesFilter(rec: WeightClassRecord, filter: RecordsFilter): boolean {
  if (filter.equipmentGroup != null && rec.equipmentGroup !== filter.equipmentGroup) return false;
  if (filter.sex != null && rec.sex !== filter.sex) return false;
  if (filter.weightClassKg != null && rec.weightClassKg !== filter.weightClassKg) return false;
  return true;
}

// Slow path: filter raw entries by age_class then recompute top-3 per
// (category, sex, equipmentGroup, weightClass). Used only when age_class
// is in the query — the precomputed table doesn't include that dimension.
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
      if (eg === "all-tested" ? !entry.tested : entry.equipment !== equipmentGroupToEquipment(eg)) {
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
    b.rows.sort((a, b) => b.value - a.value);
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
