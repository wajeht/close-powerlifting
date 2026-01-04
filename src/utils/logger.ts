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

export interface LoggerType {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string | Error, ...args: unknown[]) => void;
  box: (title: string, content: string) => void;
  setLevel: (level: LogLevel) => void;
}

export function createLogger(): LoggerType {
  function debug(message: string, ...args: unknown[]) {
    log("DEBUG", message, ...args);
  }

  function info(message: string, ...args: unknown[]) {
    log("INFO", message, ...args);
  }

  function warn(message: string, ...args: unknown[]) {
    log("WARN", message, ...args);
  }

  function error(message: string | Error, ...args: unknown[]) {
    if (message instanceof Error) {
      log("ERROR", message.message, ...args);
    } else {
      log("ERROR", message, ...args);
    }
  }

  function setLevel(level: LogLevel) {
    globalLevel = level;
  }

  function box(title: string, content: string) {
    if (priority["INFO"] < priority[globalLevel]) return;

    const divider = styleText("dim", "=".repeat(50));
    const styledTitle = styleText("cyan", title);
    const output = ["", divider, styledTitle, divider, content, divider, ""].join("\n");
    process.stdout.write(output);
  }

  return {
    debug,
    info,
    warn,
    error,
    box,
    setLevel,
  };
}
