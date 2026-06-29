import type { Database as DatabaseType } from "better-sqlite3";

import {
  EQUIPMENT_GROUP_DEFINITIONS,
  RANKING_EQUIPMENT_DEFINITIONS,
  RANKING_METRIC_DEFINITIONS,
  RECORD_CATEGORY_DEFINITIONS,
  RECORD_SEXES,
  equipmentGroupSqlCondition,
  type RankingEquipmentDefinition,
  type RankingMetricDefinition,
  type RecordCategoryDefinition,
  type EquipmentGroupDefinition,
} from "./leaderboard-definitions";

type CountableTable = "federations" | "records";

const PRECOMPUTED_RANKING_METRIC = "dots";

interface CountRow {
  count: number;
}

export function createDerivedTables(db: DatabaseType): void {
  createFederationsTable(db);
  createLifterSearchTable(db);
  createLifterBestsTable(db);
  createMetricCountsTable(db);
  createRankingFilterBestsTable(db);
  createRecordsTable(db);
}

function createFederationsTable(db: DatabaseType): void {
  db.exec(`
    CREATE TABLE federations AS
    SELECT
      federation_slug AS slug,
      MIN(federation) AS code,
      MIN(parent_federation_slug) AS parent_slug,
      COUNT(*) AS meet_count
    FROM meets
    WHERE federation_slug <> ''
    GROUP BY federation_slug
    ORDER BY meet_count DESC;

    CREATE UNIQUE INDEX idx_federations_slug ON federations(slug);
  `);
}

function createLifterBestsTable(db: DatabaseType): void {
  db.exec(`
    CREATE TABLE lifter_bests (
      metric TEXT NOT NULL,
      lifter_id INTEGER NOT NULL,
      entry_id INTEGER NOT NULL,
      value REAL NOT NULL,
      rank INTEGER NOT NULL,
      PRIMARY KEY (metric, lifter_id)
    );
  `);

  for (const { metric, field } of RANKING_METRIC_DEFINITIONS) {
    db.prepare(`
      INSERT INTO lifter_bests (metric, lifter_id, entry_id, value, rank)
      WITH best AS (
        SELECT
          lifter_id,
          id AS entry_id,
          ${field} AS value,
          ROW_NUMBER() OVER (
            PARTITION BY lifter_id
            ORDER BY ${field} DESC, id ASC
          ) AS lifter_rank
        FROM entries
        WHERE ${field} IS NOT NULL
      ),
      ranked AS (
        SELECT
          lifter_id,
          entry_id,
          value,
          ROW_NUMBER() OVER (ORDER BY value DESC, entry_id ASC) AS rank
        FROM best
        WHERE lifter_rank = 1
      )
      SELECT ?, lifter_id, entry_id, value, rank FROM ranked
    `).run(metric);
  }

  db.exec(`
    CREATE UNIQUE INDEX idx_lifter_bests_metric_rank ON lifter_bests(metric, rank);
    CREATE INDEX idx_lifter_bests_lifter ON lifter_bests(lifter_id);
  `);
}

function createLifterSearchTable(db: DatabaseType): void {
  db.exec(`
    CREATE VIRTUAL TABLE lifter_search USING fts5(
      username,
      name,
      content='lifters',
      content_rowid='id',
      tokenize='trigram'
    );

    INSERT INTO lifter_search(rowid, username, name)
    SELECT id, username, name
    FROM lifters;
  `);
}

function createMetricCountsTable(db: DatabaseType): void {
  db.exec(`
    CREATE TABLE metric_counts AS
    SELECT metric, COUNT(*) AS count
    FROM lifter_bests
    GROUP BY metric;

    CREATE UNIQUE INDEX idx_metric_counts_metric ON metric_counts(metric);
  `);
}

function createRankingFilterBestsTable(db: DatabaseType): void {
  db.exec(`
    CREATE TABLE ranking_filter_bests (
      metric TEXT NOT NULL,
      equipment_key TEXT NOT NULL,
      sex_key TEXT NOT NULL,
      entry_id INTEGER NOT NULL,
      rank INTEGER NOT NULL
    );
  `);

  const metric = rankingMetricDefinition(PRECOMPUTED_RANKING_METRIC);
  insertRankingFilterBests(db, metric);

  db.exec(`
    CREATE UNIQUE INDEX idx_ranking_filter_bests_lookup
      ON ranking_filter_bests(metric, equipment_key, sex_key, rank);
  `);
}

function rankingMetricDefinition(metric: string): RankingMetricDefinition {
  for (const definition of RANKING_METRIC_DEFINITIONS) {
    if (definition.metric === metric) return definition;
  }
  throw new Error(`Unknown ranking metric: ${metric}`);
}

function insertRankingFilterBests(db: DatabaseType, metric: RankingMetricDefinition): void {
  const bindings: string[] = [];
  const equipmentSelects: string[] = [];
  for (const equipment of RANKING_EQUIPMENT_DEFINITIONS) {
    equipmentSelects.push(rankingEquipmentSelect(metric, equipment));
    bindings.push(equipment.key, ...equipment.equipment);
  }

  db.prepare(`
    INSERT INTO ranking_filter_bests (metric, equipment_key, sex_key, entry_id, rank)
    WITH equipment_entries AS (
      ${equipmentSelects.join("\nUNION ALL\n")}
    ),
    candidates AS (
      SELECT
        equipment_key,
        'all' AS sex_key,
        entry_id,
        lifter_id,
        value
      FROM equipment_entries
      UNION ALL
      SELECT
        equipment_key,
        CASE sex WHEN 'M' THEN 'men' ELSE 'women' END AS sex_key,
        entry_id,
        lifter_id,
        value
      FROM equipment_entries
      WHERE sex IN ('M', 'F')
    ),
    best AS (
      SELECT
        equipment_key,
        sex_key,
        entry_id,
        lifter_id,
        value,
        ROW_NUMBER() OVER (
          PARTITION BY equipment_key, sex_key, lifter_id
          ORDER BY value DESC, entry_id ASC
        ) AS lifter_rank
      FROM candidates
    ),
    ranked AS (
      SELECT
        equipment_key,
        sex_key,
        entry_id,
        ROW_NUMBER() OVER (
          PARTITION BY equipment_key, sex_key
          ORDER BY value DESC, entry_id ASC
        ) AS rank
      FROM best
      WHERE lifter_rank = 1
    )
    SELECT ?, equipment_key, sex_key, entry_id, rank
    FROM ranked
  `).run(...bindings, metric.metric);
}

function rankingEquipmentSelect(
  metric: RankingMetricDefinition,
  equipment: RankingEquipmentDefinition,
): string {
  const equipmentPlaceholders = equipment.equipment.map(() => "?").join(", ");
  return `
    SELECT
      ? AS equipment_key,
      id AS entry_id,
      lifter_id,
      sex,
      ${metric.field} AS value
    FROM entries
    WHERE ${metric.field} IS NOT NULL
      AND equipment IN (${equipmentPlaceholders})
  `;
}

function createRecordsTable(db: DatabaseType): void {
  db.exec(`
    CREATE TABLE records (
      category TEXT NOT NULL,
      sex TEXT NOT NULL,
      equipment_group TEXT NOT NULL,
      age_class TEXT,
      weight_class_kg REAL NOT NULL,
      rank INTEGER NOT NULL,
      entry_id INTEGER NOT NULL,
      lift_value REAL NOT NULL
    );
  `);

  for (const category of RECORD_CATEGORY_DEFINITIONS) {
    for (const equipmentGroup of EQUIPMENT_GROUP_DEFINITIONS) {
      for (const sex of RECORD_SEXES) {
        insertRecords(db, category, equipmentGroup, sex);
      }
    }
  }

  db.exec(
    "CREATE INDEX idx_records_filter ON records(category, sex, equipment_group, age_class, weight_class_kg)",
  );
}

function insertRecords(
  db: DatabaseType,
  category: RecordCategoryDefinition,
  equipmentGroup: EquipmentGroupDefinition,
  sex: string,
): void {
  const eventPlaceholders = category.events.map(() => "?").join(", ");
  const equipmentCondition = equipmentGroupSqlCondition(equipmentGroup, null);
  db.prepare(`
    INSERT INTO records (
      category, sex, equipment_group, age_class, weight_class_kg, rank, entry_id, lift_value
    )
    WITH source AS (
      SELECT
        NULL AS age_class,
        id AS entry_id,
        weight_class_kg,
        ${category.field} AS lift_value
      FROM entries
      WHERE sex = ?
        AND event IN (${eventPlaceholders})
        AND weight_class_kg IS NOT NULL
        AND ${category.field} IS NOT NULL
        AND ${equipmentCondition}
      UNION ALL
      SELECT
        age_class,
        id AS entry_id,
        weight_class_kg,
        ${category.field} AS lift_value
      FROM entries
      WHERE sex = ?
        AND event IN (${eventPlaceholders})
        AND age_class IS NOT NULL
        AND weight_class_kg IS NOT NULL
        AND ${category.field} IS NOT NULL
        AND ${equipmentCondition}
    ),
    candidates AS (
      SELECT
        age_class,
        entry_id,
        weight_class_kg,
        lift_value,
        ROW_NUMBER() OVER (
          PARTITION BY age_class, weight_class_kg
          ORDER BY lift_value DESC, entry_id ASC
        ) AS rank
      FROM source
    )
    SELECT ?, ?, ?, age_class, weight_class_kg, rank, entry_id, lift_value
    FROM candidates
    WHERE rank <= 3
  `).run(sex, ...category.events, sex, ...category.events, category.key, sex, equipmentGroup.name);
}

export function countRows(db: DatabaseType, table: CountableTable): number {
  const row = db.prepare<[], CountRow>(`SELECT COUNT(*) AS count FROM ${table}`).get();
  if (row == null) {
    throw new Error(`Could not count rows in ${table}`);
  }
  return row.count;
}
