import { styleText } from "node:util";

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "SILENT";

const priority: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4,
};

const levelStyles: Record<Exclude<LogLevel, "SILENT">, Parameters<typeof styleText>[0]> = {
  DEBUG: "gray",
  INFO: "green",
  WARN: "yellow",
  ERROR: "red",
};

const isTest = process.env.NODE_ENV === "testing" || process.env.APP_ENV === "testing";
let globalLevel: LogLevel = isTest ? "SILENT" : "INFO";

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

function log(level: Exclude<LogLevel, "SILENT">, message: string, ...args: unknown[]): void {
  if (priority[level] < priority[globalLevel]) return;

  const timestamp = styleText("dim", `[${formatTimestamp()}]`);
  const levelLabel = styleText(levelStyles[level], level.padStart(5));
  const formattedArgs = args.map(formatValue).join(" ");
  const output = formattedArgs
    ? `${timestamp} ${levelLabel}: ${message} ${formattedArgs}\n`
    : `${timestamp} ${levelLabel}: ${message}\n`;

  if (level === "ERROR" || level === "WARN") {
    process.stderr.write(output);
  } else {
    process.stdout.write(output);
  }
}

export const logger = {
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
