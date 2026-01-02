import { Database } from "./db";
import type { User, CreateUserInput, UpdateUserInput } from "../types";

export function User() {
  const db = Database().instance;

  async function findById(id: number): Promise<User | undefined> {
    return db<User>("users").where({ id, deleted: false }).first();
  }

  async function findByEmail(email: string): Promise<User | undefined> {
    return db<User>("users").where({ email, deleted: false }).first();
  }

  async function findByVerificationToken(token: string): Promise<User | undefined> {
    return db<User>("users").where({ verification_token: token, deleted: false }).first();
  }

  async function findOne(where: Partial<User>): Promise<User | undefined> {
    return db<User>("users")
      .where({ ...where, deleted: false })
      .first();
  }

  async function findAll(where: Partial<User> = {}): Promise<User[]> {
    return db<User>("users").where({ ...where, deleted: false });
  }

  async function findVerified(): Promise<User[]> {
    return db<User>("users").where({ verified: true, deleted: false });
  }

  async function findByApiCallCount(count: number): Promise<User[]> {
    return db<User>("users").where({ api_call_count: count, verified: true, deleted: false });
  }

  async function create(data: CreateUserInput): Promise<User> {
    const [insertedId] = await db<User>("users").insert({
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

  async function update(email: string, data: UpdateUserInput): Promise<User | undefined> {
    await db<User>("users")
      .where({ email })
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      });
    return findByEmail(email);
  }

  async function updateById(id: number, data: UpdateUserInput): Promise<User | undefined> {
    await db<User>("users")
      .where({ id })
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      });
    return findById(id);
  }

  async function incrementApiCallCount(id: number): Promise<User | undefined> {
    await db<User>("users").where({ id }).increment("api_call_count", 1);
    return findById(id);
  }

  async function resetAllApiCallCounts(): Promise<void> {
    await db<User>("users").where({ verified: true }).update({ api_call_count: 0 });
  }

  async function softDelete(id: number): Promise<void> {
    await db<User>("users")
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
    resetAllApiCallCounts,
    softDelete,
  };
}
