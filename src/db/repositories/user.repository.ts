import { getDb } from '../db';

export interface User {
  id: number;
  name: string;
  email: string;
  password: string | null;
  api_call_count: number;
  api_key_version: number;
  api_call_limit: number;
  key: string | null;
  admin: boolean;
  deleted: boolean;
  verification_token: string | null;
  verified: boolean;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CreateUserInput = Pick<User, 'name' | 'email'> &
  Partial<Omit<User, 'id' | 'name' | 'email' | 'created_at' | 'updated_at'>>;

export type UpdateUserInput = Partial<Omit<User, 'id' | 'created_at'>>;

export async function findById(id: number): Promise<User | undefined> {
  const db = getDb();
  return db<User>('users').where({ id, deleted: false }).first();
}

export async function findByEmail(email: string): Promise<User | undefined> {
  const db = getDb();
  return db<User>('users').where({ email, deleted: false }).first();
}

export async function findByVerificationToken(token: string): Promise<User | undefined> {
  const db = getDb();
  return db<User>('users').where({ verification_token: token, deleted: false }).first();
}

export async function findOne(where: Partial<User>): Promise<User | undefined> {
  const db = getDb();
  return db<User>('users').where({ ...where, deleted: false }).first();
}

export async function findAll(where: Partial<User> = {}): Promise<User[]> {
  const db = getDb();
  return db<User>('users').where({ ...where, deleted: false });
}

export async function findVerified(): Promise<User[]> {
  const db = getDb();
  return db<User>('users').where({ verified: true, deleted: false });
}

export async function findByApiCallCount(count: number): Promise<User[]> {
  const db = getDb();
  return db<User>('users').where({ api_call_count: count, verified: true, deleted: false });
}

export async function create(data: CreateUserInput): Promise<User> {
  const db = getDb();
  const [id] = await db<User>('users').insert({
    ...data,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return (await findById(id)) as User;
}

export async function update(email: string, data: UpdateUserInput): Promise<User | undefined> {
  const db = getDb();
  await db<User>('users')
    .where({ email })
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    });
  return findByEmail(email);
}

export async function updateById(id: number, data: UpdateUserInput): Promise<User | undefined> {
  const db = getDb();
  await db<User>('users')
    .where({ id })
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    });
  return findById(id);
}

export async function incrementApiCallCount(id: number): Promise<User | undefined> {
  const db = getDb();
  await db<User>('users').where({ id }).increment('api_call_count', 1);
  return findById(id);
}

export async function resetAllApiCallCounts(): Promise<void> {
  const db = getDb();
  await db<User>('users').where({ verified: true }).update({ api_call_count: 0 });
}

export async function softDelete(id: number): Promise<void> {
  const db = getDb();
  await db<User>('users').where({ id }).update({ deleted: true, updated_at: new Date().toISOString() });
}
