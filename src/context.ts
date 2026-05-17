import { createLogger, type LoggerType } from "./utils/logger";
import { createHelper, type HelpersType } from "./utils/helpers";
import { createDataStore, type DataStoreType } from "./data/store";

export type { LoggerType, HelpersType, DataStoreType };

export interface AppContext {
  logger: LoggerType;
  helpers: HelpersType;
  store: DataStoreType;
}

let _context: AppContext | null = null;

export function createContext(): AppContext {
  if (_context) {
    return _context;
  }

  const logger = createLogger();
  const helpers = createHelper();
  const store = createDataStore(logger);

  _context = { logger, helpers, store };
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
