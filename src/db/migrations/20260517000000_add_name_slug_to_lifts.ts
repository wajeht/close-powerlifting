import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn("lifts", "name_slug");
  if (!hasColumn) {
    await knex.schema.alterTable("lifts", (table) => {
      table.text("name_slug").nullable();
    });
  }

  await knex.raw("CREATE INDEX IF NOT EXISTS idx_lifts_name_slug ON lifts (name_slug)");
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw("DROP INDEX IF EXISTS idx_lifts_name_slug");
  await knex.schema.alterTable("lifts", (table) => {
    table.dropColumn("name_slug");
  });
}
