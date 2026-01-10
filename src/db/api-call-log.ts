import type { Knex } from "knex";
import type { ApiCallLog, CreateApiCallLogInput } from "../types";

export interface FindAllOptions {
  userId?: number;
  search?: string;
  orderBy?: keyof ApiCallLog;
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface ApiCallLogRepositoryType {
  create: (data: CreateApiCallLogInput) => Promise<ApiCallLog>;
  findByUserId: (userId: number, options?: Omit<FindAllOptions, "userId">) => Promise<ApiCallLog[]>;
  countByUserId: (userId: number, search?: string) => Promise<number>;
  findAll: (options?: FindAllOptions) => Promise<ApiCallLog[]>;
  count: (userId?: number) => Promise<number>;
  deleteOlderThan: (date: Date) => Promise<number>;
}

function escapeLikePattern(search: string): string {
  return search.replace(/[%_\\]/g, "\\$&");
}

export function createApiCallLogRepository(knex: Knex): ApiCallLogRepositoryType {
  async function findById(id: number): Promise<ApiCallLog | undefined> {
    return knex<ApiCallLog>("api_call_logs").where({ id }).first();
  }

  async function create(data: CreateApiCallLogInput): Promise<ApiCallLog> {
    const [insertedId] = await knex<ApiCallLog>("api_call_logs").insert({
      ...data,
      created_at: new Date().toISOString(),
    });
    const log = await findById(insertedId as number);
    if (!log) {
      throw new Error("Failed to create API call log");
    }
    return log;
  }

  async function findByUserId(
    userId: number,
    options: Omit<FindAllOptions, "userId"> = {},
  ): Promise<ApiCallLog[]> {
    let query = knex<ApiCallLog>("api_call_logs").where({ user_id: userId });
    if (options.search) {
      const escaped = escapeLikePattern(options.search);
      query = query.where((qb) => {
        qb.where("endpoint", "like", `%${escaped}%`)
          .orWhere("method", "like", `%${escaped}%`)
          .orWhere("status_code", "like", `%${escaped}%`);
      });
    }
    if (options.orderBy) {
      query = query.orderBy(options.orderBy, options.order || "desc");
    } else {
      query = query.orderBy("created_at", "desc");
    }
    if (options.limit != null) {
      query = query.limit(options.limit);
    }
    if (options.offset != null) {
      query = query.offset(options.offset);
    }
    return query;
  }

  async function countByUserId(userId: number, search?: string): Promise<number> {
    let query = knex<ApiCallLog>("api_call_logs").where({ user_id: userId });
    if (search) {
      const escaped = escapeLikePattern(search);
      query = query.where((qb) => {
        qb.where("endpoint", "like", `%${escaped}%`)
          .orWhere("method", "like", `%${escaped}%`)
          .orWhere("status_code", "like", `%${escaped}%`);
      });
    }
    const result = await query.count("* as count").first<{ count: number }>();
    return Number(result?.count || 0);
  }

  async function findAll(options: FindAllOptions = {}): Promise<ApiCallLog[]> {
    let query = knex<ApiCallLog>("api_call_logs");
    if (options.userId != null) {
      query = query.where({ user_id: options.userId });
    }
    if (options.orderBy) {
      query = query.orderBy(options.orderBy, options.order || "desc");
    } else {
      query = query.orderBy("created_at", "desc");
    }
    if (options.limit != null) {
      query = query.limit(options.limit);
    }
    if (options.offset != null) {
      query = query.offset(options.offset);
    }
    return query;
  }

  async function count(userId?: number): Promise<number> {
    let query = knex<ApiCallLog>("api_call_logs");
    if (userId != null) {
      query = query.where({ user_id: userId });
    }
    const result = await query.count("* as count").first<{ count: number }>();
    return Number(result?.count || 0);
  }

  async function deleteOlderThan(date: Date): Promise<number> {
    return knex<ApiCallLog>("api_call_logs").where("created_at", "<", date.toISOString()).delete();
  }

  return {
    create,
    findByUserId,
    countByUserId,
    findAll,
    count,
    deleteOlderThan,
  };
}
