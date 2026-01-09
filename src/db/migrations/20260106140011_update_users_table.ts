import type { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("users", (table) => {
        table.string("pending_email").nullable();
        table.string("pending_email_token").nullable();
        table.timestamp("pending_email_expires_at").nullable();
    });
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable("users", (table) => {
        table.dropColumn("pending_email");
        table.dropColumn("pending_email_token");
        table.dropColumn("pending_email_expires_at");
    });
}

