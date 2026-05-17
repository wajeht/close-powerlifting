import type { Knex } from "knex";

// Materialized top-N per (category, sex, equipment_group, weight_class) for
// /api/records. Populated at the end of every successful ingest (see
// src/utils/ingest.ts). Backs the records fast path — turns 7 separate
// `ROW_NUMBER() PARTITION BY weight_class_kg` window queries over hundreds
// of thousands of rows each into a single ~5k-row table scanned by the API.
//
// Composite secondary index lets the API filter by (sex, equipment_group)
// and order by (category, weight_class, rank) without a sort.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("weight_class_records", (table) => {
    table.increments("id").primary();
    table.text("category").notNullable();
    table.text("sex").notNullable();
    table.text("equipment_group").notNullable();
    table.float("weight_class_kg").notNullable();
    table.integer("rank").notNullable();
    table.integer("lift_id").notNullable().references("id").inTable("lifts");
    table.float("lift_value").notNullable();
  });

  // Lookup index is created by the ingest pipeline (drop + recreate around
  // the bulk INSERT) so the populate step isn't maintaining the secondary
  // b-tree per row. See src/utils/ingest.ts.
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("weight_class_records");
}
