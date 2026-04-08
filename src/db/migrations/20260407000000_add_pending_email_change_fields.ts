import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn("users", "pending_email"))) {
    await knex.schema.alterTable("users", (table) => {
      table.string("pending_email").nullable();
      table.string("pending_email_token").nullable();
      table.timestamp("pending_email_expires_at").nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn("users", "pending_email")) {
    await knex.schema.alterTable("users", (table) => {
      table.dropColumns("pending_email", "pending_email_token", "pending_email_expires_at");
    });
  }
}
