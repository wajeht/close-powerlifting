import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable("users"))) {
    await knex.schema.createTable("users", (table) => {
      table.increments("id").primary();
      table.string("name").notNullable();
      table.string("email").unique().notNullable();
      table.integer("api_call_count").defaultTo(0);
      table.integer("api_key_version").defaultTo(0);
      table.integer("api_call_limit").defaultTo(500);
      table.string("key").nullable();
      table.boolean("admin").defaultTo(false);
      table.boolean("deleted").defaultTo(false);
      table.string("verification_token").unique().nullable();
      table.timestamp("magic_link_expires_at").nullable();
      table.boolean("verified").defaultTo(false);
      table.timestamp("verified_at").nullable();
      table.timestamp("created_at").defaultTo(knex.fn.now());
      table.timestamp("updated_at").defaultTo(knex.fn.now());

      table.index("email");
      table.index("verification_token");
      table.index("verified");
    });
  }

  if (!(await knex.schema.hasTable("cache"))) {
    await knex.schema.createTable("cache", (table) => {
      table.string("key").primary();
      table.text("value").notNullable();
      table.timestamp("expires_at").nullable();
      table.timestamp("created_at").defaultTo(knex.fn.now());
      table.timestamp("updated_at").defaultTo(knex.fn.now());

      table.index("expires_at");
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("cache");
  await knex.schema.dropTableIfExists("users");
}
