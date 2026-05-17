import type { Knex } from "knex";

import { configuration } from "../../../configuration";
import type { StatusData, Federation, ApiResponse } from "../../../types";
import type { GetStatusType } from "./status.validation";

export function createStatusService(knex: Knex) {
  async function fetchStatus(): Promise<StatusData> {
    const meetCountResult = await knex("meets")
      .count<{ count: number | string }[]>({ count: "*" })
      .first();
    const meetCount = Number(meetCountResult?.count ?? 0);

    const lastIngest = await knex("ingest_runs")
      .where({ status: "completed" })
      .orderBy("finished_at", "desc")
      .first<{ finished_at: string | null; source_last_modified: string | null }>();

    const federationRows = (await knex("federations")
      .select<Array<{ code: string; parent_slug: string | null }>>("code", "parent_slug")
      .orderBy("code", "asc")) as Array<{ code: string; parent_slug: string | null }>;

    const federations: Federation[] = federationRows.map((row) => ({
      name: row.code,
      meetsentered: "—",
      status: row.parent_slug ? `sanctioned by ${row.parent_slug}` : "tracked",
      newmeetdetection: "—",
      resultsformat: "—",
      easeofimport: "—",
      maintainers: "—",
    }));

    const meetsBlurb =
      meetCount > 0
        ? `Tracking ${meetCount.toLocaleString()} meets across ${federationRows.length} federations` +
          (lastIngest?.finished_at ? ` (refreshed ${lastIngest.finished_at})` : "")
        : "No meets ingested yet";

    return {
      server_version: configuration.app.version,
      meets: meetsBlurb,
      federations,
    };
  }

  async function getStatus(_options: GetStatusType): Promise<ApiResponse<StatusData>> {
    const data = await fetchStatus();
    return { data };
  }

  return {
    getStatus,
  };
}
