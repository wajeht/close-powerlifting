type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "SILENT";

const priority: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4,
};

let globalLevel: LogLevel = "INFO";

function formatTimestamp(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function formatValue(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }
  if (typeof value === "object" && value !== null) {
    try {
      return JSON.stringify(value);
    } catch {
      return "[Circular]";
    }
  }
  return String(value);
}

function log(level: LogLevel, message: string, ...args: unknown[]): void {
  if (priority[level] < priority[globalLevel]) return;

  const timestamp = `[${formatTimestamp()}]`;
  const levelLabel = level.padStart(5);
  const formattedArgs = args.map(formatValue).join(" ");
  const output = formattedArgs
    ? `${timestamp} ${levelLabel}: ${message} ${formattedArgs}`
    : `${timestamp} ${levelLabel}: ${message}`;

  if (level === "ERROR") {
    console.error(output);
  } else if (level === "WARN") {
    console.warn(output);
  } else {
    console.log(output);
  }
}

const logger = {
  debug: (message: string, ...args: unknown[]) => log("DEBUG", message, ...args),
  info: (message: string, ...args: unknown[]) => log("INFO", message, ...args),
  warn: (message: string, ...args: unknown[]) => log("WARN", message, ...args),
  error: (message: string | Error, ...args: unknown[]) => {
    if (message instanceof Error) {
      log("ERROR", message.message, ...args);
    } else {
      log("ERROR", message, ...args);
    }
  },
  setLevel: (level: LogLevel) => {
    globalLevel = level;
  },
};

export { logger };
