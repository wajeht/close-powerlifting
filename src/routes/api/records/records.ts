import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import type {
  AppData,
  EquipmentGroup,
  RecordCategory,
  Sex,
  WeightClassRecord,
} from "../../../data/types";

const SEX_BY_QUERY: Record<string, Sex> = {
  M: "M",
  F: "F",
  men: "M",
  women: "F",
};

const EQUIPMENT_GROUPS = new Set<EquipmentGroup>([
  "raw",
  "wraps",
  "single",
  "multi",
  "unlimited",
  "all-tested",
]);

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

export function createRecordsRouter(context: AppContext) {
  const router = express.Router();

  router.get("/api/records", (req: Request, res: Response) => {
    const data = context.store.get();
    const sex = parseSex(req.query.sex);
    const equipmentGroup = parseEquipmentGroup(req.query.equipment);
    const weightClassFilter = parseFloatOrNull(req.query.weight_class);

    // Single linear pass over the ~17k-row records table. Done because the
    // precomputed records are already sorted; bucketing into the response
    // shape stays O(rows-touched).
    const byCategory = new Map<RecordCategory, WeightClassRecord[]>();
    for (const rec of data.records) {
      if (rec.sex !== sex) continue;
      if (rec.equipmentGroup !== equipmentGroup) continue;
      if (weightClassFilter != null && rec.weightClassKg !== weightClassFilter) continue;
      const list = byCategory.get(rec.category);
      if (list == null) byCategory.set(rec.category, [rec]);
      else list.push(rec);
    }

    res.json({
      status: "success",
      data: {
        sex,
        equipment_group: equipmentGroup,
        weight_class_filter: weightClassFilter,
        categories: CATEGORY_ORDER.map((key) => ({
          key,
          title: CATEGORY_TITLES[key],
          records: (byCategory.get(key) ?? []).map((rec) => formatRecord(data, rec)),
        })),
      },
    });
  });

  return router;
}

function parseSex(raw: unknown): Sex {
  if (typeof raw === "string" && SEX_BY_QUERY[raw] != null) return SEX_BY_QUERY[raw];
  return "M";
}

function parseEquipmentGroup(raw: unknown): EquipmentGroup {
  if (typeof raw === "string" && EQUIPMENT_GROUPS.has(raw as EquipmentGroup)) {
    return raw as EquipmentGroup;
  }
  return "raw";
}

function parseFloatOrNull(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
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
