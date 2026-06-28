import { createLogger, type LoggerType } from "./utils/logger";
import { createHelper, type HelpersType } from "./utils/helpers";
import { createDataStore, type DataStoreType } from "./data/database";

export type { LoggerType, HelpersType, DataStoreType };

export interface AppContext {
  logger: LoggerType;
  helpers: HelpersType;
  store: DataStoreType;
}

let appContext: AppContext | null = null;

export function createContext(): AppContext {
  if (appContext != null) {
    return appContext;
  }

  const logger = createLogger();
  const helpers = createHelper();
  const store = createDataStore(logger);

  appContext = { logger, helpers, store };
  return appContext;
}

export function resetContext(): void {
  appContext?.store.reset();
  appContext = null;
}
