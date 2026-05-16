import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // federations: ~465 rows
  await knex.schema.createTable("federations", (table) => {
    table.increments("id").primary();
    table.text("slug").notNullable().unique();
    table.text("code").notNullable();
    table.text("parent_slug").nullable();
    table.index("parent_slug", "idx_federations_parent");
  });

  // lifters: ~989k rows
  await knex.schema.createTable("lifters", (table) => {
    table.increments("id").primary();
    table.text("name").notNullable();
    table.text("name_slug").notNullable().unique();
    table.text("sex").nullable();
    table.text("instagram").nullable();
    table.text("country").nullable();
    table.text("state").nullable();
  });

  await knex.raw(`
    CREATE VIRTUAL TABLE lifters_fts USING fts5(
      name,
      content='lifters',
      content_rowid='id',
      tokenize='unicode61 remove_diacritics 2',
      prefix='2 3'
    )
  `);

  // meets: ~62k rows
  await knex.schema.createTable("meets", (table) => {
    table.increments("id").primary();
    table.integer("federation_id").notNullable().references("id").inTable("federations");
    table.text("date").notNullable();
    table.text("meet_name").notNullable();
    table.text("meet_slug").notNullable();
    table.text("meet_country").nullable();
    table.text("meet_state").nullable();
    table.integer("sanctioned").notNullable().defaultTo(0);
    table.unique(["federation_id", "date", "meet_slug"], {
      indexName: "uq_meets_federation_date_slug",
    });
    table.index("date", "idx_meets_date");
    table.index(["federation_id", "date"], "idx_meets_fed_date");
  });

  await knex.raw(`
    CREATE VIRTUAL TABLE meets_fts USING fts5(
      meet_name,
      content='meets',
      content_rowid='id',
      tokenize='unicode61 remove_diacritics 2',
      prefix='2 3'
    )
  `);

  // lifts: fact table, ~3.9M rows
  await knex.schema.createTable("lifts", (table) => {
    table.increments("id").primary();
    table.integer("lifter_id").notNullable().references("id").inTable("lifters");
    table.integer("meet_id").notNullable().references("id").inTable("meets");
    table.text("event").notNullable();
    table.text("equipment").notNullable();
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
    table.integer("place_rank").nullable();
    table.text("place_status").nullable();
    table.float("dots").nullable();
    table.float("wilks").nullable();
    table.float("glossbrenner").nullable();
    table.float("goodlift").nullable();
    table.integer("tested").notNullable().defaultTo(0);

    table.index("lifter_id", "idx_lifts_lifter");
    table.index("meet_id", "idx_lifts_meet");
    table.index(["event", "equipment", "weight_class_kg", "total_kg"], "idx_lifts_rankings_total");
    table.index(["event", "equipment", "dots"], "idx_lifts_rankings_dots");
  });

  // ingest_runs: observability for nightly ingest
  await knex.schema.createTable("ingest_runs", (table) => {
    table.increments("id").primary();
    table.timestamp("started_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("finished_at").nullable();
    table.integer("lifter_count").nullable();
    table.integer("meet_count").nullable();
    table.integer("federation_count").nullable();
    table.integer("lift_count").nullable();
    table.bigInteger("byte_size").nullable();
    table.text("source_last_modified").nullable();
    table.text("status").notNullable();
    table.text("error").nullable();
    table.index("started_at", "idx_ingest_runs_started_at");
    table.index("status", "idx_ingest_runs_status");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("ingest_runs");
  await knex.schema.dropTableIfExists("lifts");
  await knex.raw("DROP TABLE IF EXISTS meets_fts");
  await knex.schema.dropTableIfExists("meets");
  await knex.raw("DROP TABLE IF EXISTS lifters_fts");
  await knex.schema.dropTableIfExists("lifters");
  await knex.schema.dropTableIfExists("federations");
}
