import type { Knex } from "knex";
import type { User as UserType, CreateUserInput, UpdateUserInput } from "../types";

export interface UserRepositoryType {
  findById: (id: number) => Promise<UserType | undefined>;
  findByEmail: (email: string) => Promise<UserType | undefined>;
  findByVerificationToken: (token: string) => Promise<UserType | undefined>;
  findOne: (where: Partial<UserType>) => Promise<UserType | undefined>;
  findAll: (where?: Partial<UserType>) => Promise<UserType[]>;
  findVerified: () => Promise<UserType[]>;
  findByApiCallCount: (count: number) => Promise<UserType[]>;
  create: (data: CreateUserInput) => Promise<UserType>;
  update: (email: string, data: UpdateUserInput) => Promise<UserType | undefined>;
  updateById: (id: number, data: UpdateUserInput) => Promise<UserType | undefined>;
  incrementApiCallCount: (id: number) => Promise<UserType | undefined>;
  setApiCallCount: (id: number, count: number) => Promise<UserType | undefined>;
  resetAllApiCallCounts: () => Promise<void>;
  softDelete: (id: number) => Promise<void>;
}

export function createUserRepository(knex: Knex): UserRepositoryType {
  async function findById(id: number): Promise<UserType | undefined> {
    return knex<UserType>("users").where({ id, deleted: false }).first();
  }

  async function findByEmail(email: string): Promise<UserType | undefined> {
    return knex<UserType>("users").where({ email, deleted: false }).first();
  }

  async function findByVerificationToken(token: string): Promise<UserType | undefined> {
    return knex<UserType>("users").where({ verification_token: token, deleted: false }).first();
  }

  async function findOne(where: Partial<UserType>): Promise<UserType | undefined> {
    return knex<UserType>("users")
      .where({ ...where, deleted: false })
      .first();
  }

  async function findAll(where: Partial<UserType> = {}): Promise<UserType[]> {
    return knex<UserType>("users").where({ ...where, deleted: false });
  }

  async function findVerified(): Promise<UserType[]> {
    return knex<UserType>("users").where({ verified: true, deleted: false });
  }

  async function findByApiCallCount(count: number): Promise<UserType[]> {
    return knex<UserType>("users").where({
      api_call_count: count,
      verified: true,
      deleted: false,
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

  async function softDelete(id: number): Promise<void> {
    await knex<UserType>("users")
      .where({ id })
      .update({ deleted: true, updated_at: new Date().toISOString() });
  }

  return {
    findById,
    findByEmail,
    findByVerificationToken,
    findOne,
    findAll,
    findVerified,
    findByApiCallCount,
    create,
    update,
    updateById,
    incrementApiCallCount,
    setApiCallCount,
    resetAllApiCallCounts,
    softDelete,
  };
}
