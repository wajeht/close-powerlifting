import fs from "node:fs";
import path from "node:path";

export const DATABASE_FILE_NAME = "close-powerlifting.sqlite";
export const DATABASE_ARCHIVE_FILE_NAME = `${DATABASE_FILE_NAME}.gz`;
export const DATABASE_SCHEMA_VERSION = 3;
export const SNAPSHOT_DIR = resolveSnapshotDir();
export const DATABASE_FILE = path.join(SNAPSHOT_DIR, DATABASE_FILE_NAME);

function resolveSnapshotDir(): string {
  const compiledSnapshotDir = path.join(__dirname, "snapshot");
  if (hasSnapshot(compiledSnapshotDir)) return compiledSnapshotDir;

  const sourceSnapshotDir = path.join(process.cwd(), "src", "data", "snapshot");
  if (sourceSnapshotDir !== compiledSnapshotDir && hasSnapshot(sourceSnapshotDir)) {
    return sourceSnapshotDir;
  }

  return compiledSnapshotDir;
}

function hasSnapshot(snapshotDir: string): boolean {
  return fs.existsSync(path.join(snapshotDir, DATABASE_FILE_NAME));
}
