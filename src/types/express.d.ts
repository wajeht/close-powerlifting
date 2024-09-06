import { User } from './user';

declare global {
  namespace Express {
    interface Request {
      user: Pick<User, 'id' | 'name' | 'email'>;
    }
  }
}
