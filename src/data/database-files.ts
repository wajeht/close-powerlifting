import path from "node:path";

export const DATABASE_FILE_NAME = "close-powerlifting.sqlite";
export const DATABASE_SCHEMA_VERSION = 1;
export const SNAPSHOT_DIR = path.join(__dirname, "snapshot");
export const DATABASE_FILE = path.join(SNAPSHOT_DIR, DATABASE_FILE_NAME);
