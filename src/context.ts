import type { Knex } from "knex";

import { createLogger, type LoggerType } from "./utils/logger";
import { createHelper, type HelpersType } from "./utils/helpers";
import { createDatabase, type DatabaseType } from "./db/db";
import { createCache, type CacheType } from "./db/cache";
import { createMail, type MailType } from "./mail";
import { createUserRepository, type UserRepositoryType } from "./db/user";
import { createScraper, type ScraperType } from "./utils/scraper";
import { createCron, type CronType } from "./cron";
import { createAuthService, type AuthServiceType } from "./routes/auth/auth.service";
import { createAdminUser, type AdminUserType } from "./utils/admin-user";

export type {
  LoggerType,
  HelpersType,
  DatabaseType,
  CacheType,
  MailType,
  UserRepositoryType,
  ScraperType,
  CronType,
  AuthServiceType,
  AdminUserType,
};

export interface AppContext {
  db: Knex;
  database: DatabaseType;
  logger: LoggerType;
  helpers: HelpersType;
  cache: CacheType;
  mail: MailType;
  userRepository: UserRepositoryType;
  scraper: ScraperType;
  cron: CronType;
  authService: AuthServiceType;
  adminUser: AdminUserType;
}

let _context: AppContext | null = null;

export function createContext(): AppContext {
  if (_context) {
    return _context;
  }

  const logger = createLogger();
  const helpers = createHelper();
  const database = createDatabase(logger);
  const db = database.instance;
  const cache = createCache(db, logger);
  const mail = createMail(logger);
  const userRepository = createUserRepository(db);
  const scraper = createScraper(cache, logger);
  const authService = createAuthService(userRepository, helpers, mail);
  const cron = createCron(cache, userRepository, mail, logger);
  const adminUser = createAdminUser(userRepository, helpers, authService, mail, logger);

  _context = {
    db,
    database,
    logger,
    helpers,
    cache,
    mail,
    userRepository,
    scraper,
    cron,
    authService,
    adminUser,
  };

  return _context;
}

export function getContext(): AppContext {
  if (!_context) {
    return createContext();
  }
  return _context;
}

export function resetContext(): void {
  _context = null;
}
