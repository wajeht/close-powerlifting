import type { Knex } from "knex";

// Append-only audit log of API calls. Distinct from the old quota system:
// no per-user counter, no limit, no monthly reset, no notifications — just
// a record the user can read on their dashboard for their own debugging.

export interface ApiCallLog {
  id: number;
  user_id: number;
  method: string;
  endpoint: string;
  status_code: number;
  response_time_ms: number;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface ApiCallLogInput {
  user_id: number;
  method: string;
  endpoint: string;
  status_code: number;
  response_time_ms: number;
  ip_address: string | null;
  user_agent: string | null;
}

export interface ApiCallLogRepositoryType {
  create: (input: ApiCallLogInput) => Promise<void>;
  findByUserId: (
    userId: number,
    options?: { limit?: number; offset?: number; search?: string },
  ) => Promise<ApiCallLog[]>;
  countByUserId: (userId: number, search?: string) => Promise<number>;
  countByUserIdSince: (userId: number, sinceIso: string) => Promise<number>;
  countAll: () => Promise<number>;
  deleteOlderThan: (cutoffIso: string) => Promise<number>;
}

export function createApiCallLogRepository(knex: Knex): ApiCallLogRepositoryType {
  async function create(input: ApiCallLogInput): Promise<void> {
    await knex("api_call_logs").insert(input);
  }

  // The status_code LIKE clause lets admins search by partial status (e.g. "4"
  // to find all client errors); the cast goes through SQLite's implicit
  // numeric-to-text conversion which works on the int column without an index.
  function applySearch(query: Knex.QueryBuilder, search: string | undefined): Knex.QueryBuilder {
    if (search == null || search === "") return query;
    const like = `%${search}%`;
    return query.andWhere((builder) => {
      builder
        .where("endpoint", "like", like)
        .orWhere("method", "like", like)
        .orWhereRaw("CAST(status_code AS TEXT) LIKE ?", [like]);
    });
  }

  async function findByUserId(
    userId: number,
    options: { limit?: number; offset?: number; search?: string } = {},
  ): Promise<ApiCallLog[]> {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    const query = knex("api_call_logs").where({ user_id: userId });
    return (await applySearch(query, options.search)
      .orderBy("id", "desc")
      .limit(limit)
      .offset(offset)) as ApiCallLog[];
  }

  async function countByUserId(userId: number, search?: string): Promise<number> {
    const query = knex("api_call_logs").where({ user_id: userId });
    const row = await applySearch(query, search)
      .count<{ count: number | string }[]>({ count: "id" })
      .first();
    return Number(row?.count ?? 0);
  }

  async function countByUserIdSince(userId: number, sinceIso: string): Promise<number> {
    const row = await knex("api_call_logs")
      .where({ user_id: userId })
      .andWhere("created_at", ">=", sinceIso)
      .count<{ count: number | string }[]>({ count: "id" })
      .first();
    return Number(row?.count ?? 0);
  }

  async function countAll(): Promise<number> {
    const row = await knex("api_call_logs")
      .count<{ count: number | string }[]>({ count: "id" })
      .first();
    return Number(row?.count ?? 0);
  }

  async function deleteOlderThan(cutoffIso: string): Promise<number> {
    return (await knex("api_call_logs").where("created_at", "<", cutoffIso).del()) as number;
  }

  return {
    create,
    findByUserId,
    countByUserId,
    countByUserIdSince,
    countAll,
    deleteOlderThan,
  };
}
