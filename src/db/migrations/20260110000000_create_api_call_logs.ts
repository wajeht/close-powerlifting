import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable("api_call_logs"))) {
    await knex.schema.createTable("api_call_logs", (table) => {
      table.increments("id").primary();
      table.integer("user_id").notNullable();
      table.string("method", 10).notNullable();
      table.string("endpoint", 512).notNullable();
      table.integer("status_code").notNullable();
      table.integer("response_time_ms").notNullable();
      table.string("ip_address", 45).nullable();
      table.string("user_agent", 512).nullable();
      table.timestamp("created_at").defaultTo(knex.fn.now());

      table.index(["user_id", "created_at"]);
      table.index("created_at");
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("api_call_logs");
}
