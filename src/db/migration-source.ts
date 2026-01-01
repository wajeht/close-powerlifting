import fs from 'fs';
import path from 'path';
import type { Knex } from 'knex';

class CustomMigrationSource implements Knex.MigrationSource<string> {
  private migrationsDir: string;

  constructor(migrationsDir: string) {
    this.migrationsDir = migrationsDir;
  }

  getMigrations(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      fs.readdir(this.migrationsDir, (err, files) => {
        if (err) {
          return reject(err);
        }
        const migrations = files
          .filter((file) => file.endsWith('.ts') || file.endsWith('.js'))
          .sort();
        resolve(migrations);
      });
    });
  }

  getMigrationName(migration: string): string {
    return migration;
  }

  getMigration(migration: string): Promise<Knex.Migration> {
    const migrationPath = path.join(this.migrationsDir, migration);
    return import(migrationPath);
  }
}

export default CustomMigrationSource;
