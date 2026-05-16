import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable("lifts"))) {
    await knex.schema.createTable("lifts", (table) => {
      table.increments("id").primary();
      table.text("name").notNullable();
      table.text("sex").nullable();
      table.text("event").nullable();
      table.text("equipment").nullable();
      table.float("age").nullable();
      table.text("age_class").nullable();
      table.text("birth_year_class").nullable();
      table.text("division").nullable();
      table.float("bodyweight_kg").nullable();
      table.float("weight_class_kg").nullable();
      table.float("squat1_kg").nullable();
      table.float("squat2_kg").nullable();
      table.float("squat3_kg").nullable();
      table.float("squat4_kg").nullable();
      table.float("bench1_kg").nullable();
      table.float("bench2_kg").nullable();
      table.float("bench3_kg").nullable();
      table.float("bench4_kg").nullable();
      table.float("deadlift1_kg").nullable();
      table.float("deadlift2_kg").nullable();
      table.float("deadlift3_kg").nullable();
      table.float("deadlift4_kg").nullable();
      table.float("best3_squat_kg").nullable();
      table.float("best3_bench_kg").nullable();
      table.float("best3_deadlift_kg").nullable();
      table.float("total_kg").nullable();
      table.text("place").nullable();
      table.float("dots").nullable();
      table.float("wilks").nullable();
      table.float("glossbrenner").nullable();
      table.float("goodlift").nullable();
      table.text("tested").nullable();
      table.text("country").nullable();
      table.text("state").nullable();
      table.text("federation").nullable();
      table.text("parent_federation").nullable();
      table.text("date").notNullable();
      table.text("meet_country").nullable();
      table.text("meet_state").nullable();
      table.text("meet_name").nullable();
      table.text("sanctioned").nullable();

      table.index("name", "idx_lifts_name");
      table.index("date", "idx_lifts_date");
      table.index(["sex", "equipment", "weight_class_kg", "total_kg"], "idx_lifts_rankings_total");
      table.index(["sex", "equipment", "dots"], "idx_lifts_rankings_dots");
      table.index(["federation", "date"], "idx_lifts_federation");
      table.index(["meet_name", "date"], "idx_lifts_meet");
    });

    await knex.raw(`
      CREATE VIRTUAL TABLE IF NOT EXISTS lifts_fts USING fts5(
        name,
        meet_name,
        content='lifts',
        content_rowid='id',
        tokenize='unicode61 remove_diacritics 2',
        prefix='2 3'
      )
    `);
  }

  if (!(await knex.schema.hasTable("ingest_runs"))) {
    await knex.schema.createTable("ingest_runs", (table) => {
      table.increments("id").primary();
      table.timestamp("started_at").notNullable().defaultTo(knex.fn.now());
      table.timestamp("finished_at").nullable();
      table.integer("row_count").nullable();
      table.bigInteger("byte_size").nullable();
      table.text("source_last_modified").nullable();
      table.text("status").notNullable();
      table.text("error").nullable();

      table.index("started_at", "idx_ingest_runs_started_at");
      table.index("status", "idx_ingest_runs_status");
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("ingest_runs");
  await knex.raw("DROP TABLE IF EXISTS lifts_fts");
  await knex.schema.dropTableIfExists("lifts");
}
