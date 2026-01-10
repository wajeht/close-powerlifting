import type { Knex } from "knex";
import type { User as UserType, CreateUserInput, UpdateUserInput } from "../types";

export interface FindAllOptions {
  where?: Partial<UserType>;
  search?: string;
  orderBy?: keyof UserType;
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface UserRepositoryType {
  findById: (id: number) => Promise<UserType | undefined>;
  findByEmail: (email: string) => Promise<UserType | undefined>;
  findByVerificationToken: (token: string) => Promise<UserType | undefined>;
  findOne: (where: Partial<UserType>) => Promise<UserType | undefined>;
  findAll: (options?: FindAllOptions) => Promise<UserType[]>;
  count: (where?: Partial<UserType>, search?: string) => Promise<number>;
  findVerified: () => Promise<UserType[]>;
  findByApiCallCount: (count: number) => Promise<UserType[]>;
  create: (data: CreateUserInput) => Promise<UserType>;
  update: (email: string, data: UpdateUserInput) => Promise<UserType | undefined>;
  updateById: (id: number, data: UpdateUserInput) => Promise<UserType | undefined>;
  consumeToken: (userId: number, expectedToken: string) => Promise<boolean>;
  incrementApiCallCount: (id: number) => Promise<UserType | undefined>;
  setApiCallCount: (id: number, count: number) => Promise<UserType | undefined>;
  resetAllApiCallCounts: () => Promise<void>;
  delete: (id: number) => Promise<void>;
}

export function createUserRepository(knex: Knex): UserRepositoryType {
  async function findById(id: number): Promise<UserType | undefined> {
    return knex<UserType>("users").where({ id }).first();
  }

  async function findByEmail(email: string): Promise<UserType | undefined> {
    return knex<UserType>("users").where({ email }).first();
  }

  async function findByVerificationToken(token: string): Promise<UserType | undefined> {
    return knex<UserType>("users").where({ verification_token: token }).first();
  }

  async function findOne(where: Partial<UserType>): Promise<UserType | undefined> {
    return knex<UserType>("users").where(where).first();
  }

  async function findAll(options: FindAllOptions = {}): Promise<UserType[]> {
    let query = knex<UserType>("users").where(options.where || {});
    if (options.search) {
      const searchPattern = `%${options.search.toLowerCase()}%`;
      query = query.andWhere(function () {
        this.whereRaw("LOWER(name) LIKE ?", [searchPattern]).orWhereRaw("LOWER(email) LIKE ?", [
          searchPattern,
        ]);
      });
    }
    if (options.orderBy) {
      query = query.orderBy(options.orderBy, options.order || "asc");
    }
    if (options.limit != null) {
      query = query.limit(options.limit);
    }
    if (options.offset != null) {
      query = query.offset(options.offset);
    }
    return query;
  }

  async function count(where: Partial<UserType> = {}, search?: string): Promise<number> {
    let query = knex<UserType>("users").where(where);
    if (search) {
      const searchPattern = `%${search.toLowerCase()}%`;
      query = query.andWhere(function () {
        this.whereRaw("LOWER(name) LIKE ?", [searchPattern]).orWhereRaw("LOWER(email) LIKE ?", [
          searchPattern,
        ]);
      });
    }
    const result = await query.count("* as count").first<{ count: number }>();
    return Number(result?.count || 0);
  }

  async function findVerified(): Promise<UserType[]> {
    return knex<UserType>("users").where({ verified: true });
  }

  async function findByApiCallCount(count: number): Promise<UserType[]> {
    return knex<UserType>("users").where({
      api_call_count: count,
      verified: true,
    });
  }

  async function create(data: CreateUserInput): Promise<UserType> {
    const [insertedId] = await knex<UserType>("users").insert({
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const user = await findById(insertedId as number);
    if (!user) {
      throw new Error("Failed to create user");
    }
    return user;
  }

  async function update(email: string, data: UpdateUserInput): Promise<UserType | undefined> {
    await knex<UserType>("users")
      .where({ email })
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      });
    return findByEmail(email);
  }

  async function updateById(id: number, data: UpdateUserInput): Promise<UserType | undefined> {
    await knex<UserType>("users")
      .where({ id })
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      });
    return findById(id);
  }

  async function consumeToken(userId: number, expectedToken: string): Promise<boolean> {
    const updatedCount = await knex<UserType>("users")
      .where({
        id: userId,
        verification_token: expectedToken,
      })
      .update({
        verification_token: null,
        magic_link_expires_at: null,
        updated_at: new Date().toISOString(),
      });
    return updatedCount > 0;
  }

  async function incrementApiCallCount(id: number): Promise<UserType | undefined> {
    await knex<UserType>("users").where({ id }).increment("api_call_count", 1);
    return findById(id);
  }

  async function setApiCallCount(id: number, count: number): Promise<UserType | undefined> {
    await knex<UserType>("users").where({ id }).update({
      api_call_count: count,
      updated_at: new Date().toISOString(),
    });
    return findById(id);
  }

  async function resetAllApiCallCounts(): Promise<void> {
    await knex<UserType>("users").where({ verified: true }).update({ api_call_count: 0 });
  }

  async function deleteUser(id: number): Promise<void> {
    await knex<UserType>("users").where({ id }).delete();
  }

  return {
    findById,
    findByEmail,
    findByVerificationToken,
    findOne,
    findAll,
    count,
    findVerified,
    findByApiCallCount,
    create,
    update,
    updateById,
    consumeToken,
    incrementApiCallCount,
    setApiCallCount,
    resetAllApiCallCounts,
    delete: deleteUser,
  };
}
