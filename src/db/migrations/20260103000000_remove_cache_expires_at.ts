import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn("cache", "expires_at")) {
    await knex.schema.alterTable("cache", (table) => {
      table.dropIndex("expires_at");
      table.dropColumn("expires_at");
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn("cache", "expires_at"))) {
    await knex.schema.alterTable("cache", (table) => {
      table.timestamp("expires_at").nullable();
      table.index("expires_at");
    });
  }
}
