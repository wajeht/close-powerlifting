import { WithId } from 'mongodb';
import { string, z } from 'zod';

import { db } from '../utils/db';

export const User = z.object({
  name: z.string(),
  email: z.string().email(),
  key: z.string().nullish(),
  delete: z.boolean().default(false),
  verification_token: string(),
  verified: z.boolean().default(false),
  verified_at: z.string().nullish(),
  created_at: z.date().default(new Date()),
});

export type User = z.infer<typeof User>;
export type UserWithId = WithId<User>;
export const Users = db.collection<User>('users');
