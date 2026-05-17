import type { Knex } from "knex";

// Materialized per-lifter best across (event, equipment). Populated at the
// end of every successful ingest (see src/utils/ingest.ts). Backs the fast
// path for /api/rankings — turns a "ROW_NUMBER() PARTITION BY lifter_id over
// 3.9M rows" query into an index scan over ~1M rows.
//
// `best_lift_id` points to the lift row that wins on `dots` within the slice;
// the denormalized metric columns carry that row's values so rankings can
// sort + paginate without joining lifts at all. The JOIN to lifts/lifters/
// meets/federations only happens for the rendered page (≤50 rows), not for
// the full 1M-row sort.

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("lifter_bests", (table) => {
    table.integer("lifter_id").notNullable().references("id").inTable("lifters");
    table.text("event").notNullable();
    table.text("equipment").notNullable();
    table.integer("best_lift_id").notNullable().references("id").inTable("lifts");
    table.float("dots").nullable();
    table.float("wilks").nullable();
    table.float("glossbrenner").nullable();
    table.float("goodlift").nullable();
    table.float("total_kg").nullable();
    table.float("best3_squat_kg").nullable();
    table.float("best3_bench_kg").nullable();
    table.float("best3_deadlift_kg").nullable();
    table.primary(["lifter_id", "event", "equipment"]);
  });

  // The 8 metric indexes (dots/wilks/glossbrenner/goodlift/total/squat/bench/
  // deadlift, all DESC) are NOT created here. The ingest pipeline drops +
  // re-creates them around the bulk INSERT so the populate step isn't
  // maintaining 8 b-trees per row. See src/utils/ingest.ts.
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("lifter_bests");
}
