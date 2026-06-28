import type { Entry, Equipment, EquipmentGroup, RankMetric, RecordCategory, Sex } from "./types";

export interface RankingMetricDefinition {
  metric: RankMetric;
  field: string;
}

export const RANKING_METRIC_DEFINITIONS: ReadonlyArray<RankingMetricDefinition> = [
  { metric: "dots", field: "dots" },
  { metric: "wilks", field: "wilks" },
  { metric: "glossbrenner", field: "glossbrenner" },
  { metric: "goodlift", field: "goodlift" },
  { metric: "total", field: "total_kg" },
  { metric: "squat", field: "best3_squat_kg" },
  { metric: "bench", field: "best3_bench_kg" },
  { metric: "deadlift", field: "best3_deadlift_kg" },
];

export interface RecordCategoryDefinition {
  key: RecordCategory;
  title: string;
  field: string;
  events: ReadonlyArray<Entry["event"]>;
}

export const RECORD_CATEGORY_DEFINITIONS: ReadonlyArray<RecordCategoryDefinition> = [
  {
    key: "squat_full_power",
    title: "Squat (Full Power)",
    field: "best3_squat_kg",
    events: ["SBD"],
  },
  {
    key: "squat_all_events",
    title: "Squat (All Events)",
    field: "best3_squat_kg",
    events: ["SBD", "S", "SB", "SD"],
  },
  {
    key: "bench_full_power",
    title: "Bench (Full Power)",
    field: "best3_bench_kg",
    events: ["SBD"],
  },
  {
    key: "bench_all_events",
    title: "Bench (All Events)",
    field: "best3_bench_kg",
    events: ["SBD", "B", "SB", "BD"],
  },
  {
    key: "deadlift_full_power",
    title: "Deadlift (Full Power)",
    field: "best3_deadlift_kg",
    events: ["SBD"],
  },
  {
    key: "deadlift_all_events",
    title: "Deadlift (All Events)",
    field: "best3_deadlift_kg",
    events: ["SBD", "D", "SD", "BD"],
  },
  { key: "total", title: "Total", field: "total_kg", events: ["SBD"] },
];

export interface EquipmentGroupDefinition {
  name: EquipmentGroup;
  equipment: Equipment | null;
  testedOnly: boolean;
}

export const EQUIPMENT_GROUP_DEFINITIONS: ReadonlyArray<EquipmentGroupDefinition> = [
  { name: "raw", equipment: "Raw", testedOnly: false },
  { name: "wraps", equipment: "Wraps", testedOnly: false },
  { name: "single", equipment: "Single-ply", testedOnly: false },
  { name: "multi", equipment: "Multi-ply", testedOnly: false },
  { name: "unlimited", equipment: "Unlimited", testedOnly: false },
  { name: "all-tested", equipment: null, testedOnly: true },
];

export const RECORD_SEXES: ReadonlyArray<Sex> = ["M", "F"];

export function fieldForRankMetric(metric: RankMetric): string {
  for (const definition of RANKING_METRIC_DEFINITIONS) {
    if (definition.metric === metric) return definition.field;
  }
  throw new Error(`Unknown rank metric: ${metric}`);
}

export function equipmentGroupSqlCondition(
  definition: EquipmentGroupDefinition,
  tableAlias: string | null,
): string {
  const prefix = tableAlias == null ? "" : `${tableAlias}.`;
  if (definition.testedOnly) return `${prefix}tested = 1`;
  if (definition.equipment == null) {
    throw new Error(`Equipment group ${definition.name} has no equipment value`);
  }
  return `${prefix}equipment = '${definition.equipment}'`;
}
