// Dependency-injection container for the app. Everything reads through
// AppContext so tests can swap in stubs and routes don't reach for module
// singletons. Slim: no database, no auth, no mail — just the in-memory data
// store, logger, and helpers.

import { createLogger, type LoggerType } from "./utils/logger";
import { createHelper, type HelpersType } from "./utils/helpers";
import { createCron, type CronType } from "./cron";
import { createDataStore, type DataStoreType } from "./data/store";

export type { LoggerType, HelpersType, CronType, DataStoreType };

export interface AppContext {
  logger: LoggerType;
  helpers: HelpersType;
  store: DataStoreType;
  cron: CronType;
}

let _context: AppContext | null = null;

export function createContext(): AppContext {
  if (_context) {
    return _context;
  }

  const logger = createLogger();
  const helpers = createHelper();
  const store = createDataStore(logger);
  const cron = createCron(logger, store);

  _context = { logger, helpers, store, cron };
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
