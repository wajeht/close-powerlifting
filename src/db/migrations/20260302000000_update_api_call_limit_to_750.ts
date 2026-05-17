import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex("users").where("api_call_limit", 500).update({ api_call_limit: 750 });
}

export async function down(knex: Knex): Promise<void> {
  await knex("users").where("api_call_limit", 750).update({ api_call_limit: 500 });
}
