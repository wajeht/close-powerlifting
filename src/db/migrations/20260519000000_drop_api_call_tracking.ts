import type { Knex } from "knex";

// Drops the per-user quota columns introduced by the old "scrape-and-cache"
// design. The `api_call_logs` table is kept and re-purposed as a read-only
// audit log surfaced on the user dashboard — see `src/db/api-call-log.ts`.

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn("users", "api_call_count")) {
    await knex.schema.alterTable("users", (table) => {
      table.dropColumn("api_call_count");
    });
  }

  if (await knex.schema.hasColumn("users", "api_call_limit")) {
    await knex.schema.alterTable("users", (table) => {
      table.dropColumn("api_call_limit");
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("users", (table) => {
    table.integer("api_call_count").defaultTo(0);
    table.integer("api_call_limit").defaultTo(750);
  });
}
