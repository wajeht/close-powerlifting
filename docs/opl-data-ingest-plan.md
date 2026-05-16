# OpenPowerlifting Data Ingest Plan

## Problem

Close Powerlifting is currently a scrape-and-cache proxy over OpenPowerlifting's HTML pages. Every API call risks an upstream fetch + DOM parse. We can't add per-lifter metadata, can't search efficiently, can't aggregate, can't dedupe — the cache stores opaque JSON blobs keyed by request URL.

OpenPowerlifting publishes the entire dataset as a nightly bulk CSV explicitly intended for downstream use ([source](https://openpowerlifting.gitlab.io/opl-csv/bulk-csv.html)). The right architecture is to own that data in our own normalized SQLite, transform it cleanly at ingest, then serve every API endpoint from indexed local queries.

## Goal

Replace the proxy with a database. Nightly ingest pulls the CSV, transforms it into a clean normalized schema, and atomically swaps it in. Every API endpoint becomes a SQL query against locally-owned data: no upstream dependency on the read path, no DOM parsing, no cache layer, sub-millisecond hot queries.

API contract stays unchanged for existing endpoints; only the implementation moves to SQL.

## Source data (what the CSV looks like)

- **URL:** `https://openpowerlifting.gitlab.io/opl-csv/files/openpowerlifting-latest.zip`
- **Size:** 158 MB zipped (~700–900 MB unzipped)
- **Rows:** ~3.9 million
- **Update cadence:** nightly
- **Format:** one CSV file, ~30 columns. License: ODbL/CC0, downstream use encouraged.

Each row is **one lifter's performance in one event at one meet**. Lifter info, meet info, federation, and outcome are all packed into the same row. The same lifter appears 1–100+ times. The same meet appears once per competitor.

```
lifts (3.9M rows — denormalized, every row repeats lifter/meet/fed info)
┌──────────────┬─────┬──────┬──────────┬─────┬──────────────┬────────────┬──────────┬─────┬────────────┐
│ Name         │ Sex │ Age  │ Bw_kg    │ Wcl │ MeetName     │ Federation │ Date     │ Eq  │ Total_Kg   │
├──────────────┼─────┼──────┼──────────┼─────┼──────────────┼────────────┼──────────┼─────┼────────────┤
│ John Haack   │ M   │ 30   │ 99.5     │ 100 │ WRPF Am Pro  │ WRPF       │ 2024-05  │ Raw │ 1020       │
│ John Haack   │ M   │ 31   │ 100.0    │ 100 │ Raw Nationals│ USAPL      │ 2025-03  │ Raw │ 1015       │
│ K. Hawkins   │ F   │ 35   │ 74.5     │ 75  │ WRPF Am Pro  │ WRPF       │ 2024-05  │ Raw │ 607.5      │
└──────────────┴─────┴──────┴──────────┴─────┴──────────────┴────────────┴──────────┴─────┴────────────┘
```

### CSV columns (mapped to our target)

| Group                      | Columns                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| Lifter identity            | Name, Sex, Country, State                                                                       |
| Lifter at the time of meet | Age, AgeClass, BirthYearClass, BodyweightKg, WeightClassKg, Division                            |
| Meet                       | Federation, ParentFederation, Date, MeetCountry, MeetState, MeetName, Sanctioned                |
| Event                      | Event (SBD/B/D/BD/S/SB/SD), Equipment (Raw/Wraps/Single-ply/Multi-ply/Unlimited/Straps), Tested |
| Attempts                   | Squat1Kg..Squat4Kg, Bench1Kg..Bench4Kg, Deadlift1Kg..Deadlift4Kg (negatives = failed lifts)     |
| Best                       | Best3SquatKg, Best3BenchKg, Best3DeadliftKg, TotalKg                                            |
| Outcome                    | Place ("1", "2", … or "DQ"/"DD"/"G"/"NS"), Dots, Wilks, Glossbrenner, Goodlift                  |

Key data quirks we'll normalize:

- `Place` is mixed numeric + status codes.
- `Tested`, `Sanctioned` are `"Yes"`/`""` strings.
- Federation casing varies (`WRPF`, `wrpf`, `WRPF-UK`).
- Names have disambiguation suffixes (`John Smith #1`).
- Some `WeightClassKg` rows are stored as negative for "below X" classes.

## Target schema (normalized)

Four tables. The flat CSV row gets decomposed into three entities + one fact table that holds only what's actually unique per performance.

```
federations                   meets                                 lifters
┌─────┬───────┬────────┐      ┌─────┬─────┬──────┬──────┬────────┐  ┌──────┬──────────┬──────┬─────┬──────┐
│ id  │ slug  │ parent │      │ id  │ fed │ date │ slug │ name   │  │ id   │ name     │ slug │ sex │ ig   │
├─────┼───────┼────────┤      ├─────┼─────┼──────┼──────┼────────┤  ├──────┼──────────┼──────┼─────┼──────┤
│ 100 │ wrpf  │ NULL   │      │ 10  │ 100 │ ...  │ wamp │ WRPF…  │  │ 1    │ John H.  │ jh   │ M   │ ...  │
│ 101 │ usapl │ NULL   │      │ 11  │ 101 │ ...  │ rn   │ Raw N. │  │ 2    │ Kristy   │ kh   │ F   │ ...  │
└─────┴───────┴────────┘      └─────┴─────┴──────┴──────┴────────┘  └──────┴──────────┴──────┴─────┴──────┘
~465 rows                      ~62k rows                              ~989k rows

                       lifts (fact table — performance data only)
                       ┌────┬───────────┬─────────┬───────┬──────┬─────┬───────┬───────┐
                       │ id │ lifter_id │ meet_id │ event │ age  │ bw  │ total │ ...   │
                       ├────┼───────────┼─────────┼───────┼──────┼─────┼───────┼───────┤
                       │ 1  │ 1         │ 10      │ SBD   │ 30   │ 99.5│ 1020  │ ...   │
                       └────┴───────────┴─────────┴───────┴──────┴─────┴───────┴───────┘
                       ~3.9M rows
```

### Why this shape

- "Add an Instagram handle to John Haack" = one row update on `lifters`, not 100+ rows of `lifts`.
- "Federation typo: USAPL → USA-PL" = one row update on `federations`.
- FTS indexes shrink dramatically:
  - `lifters_fts` over ~989k names (vs. 3.9M today)
  - `meets_fts` over ~62k meet names (vs. embedded in lifts today)
- Search returns distinct lifters/meets natively — no `ROW_NUMBER() PARTITION BY` dedup gymnastics.

### Schema (concrete)

```sql
CREATE TABLE federations (
  id            INTEGER PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,    -- lowercased, alphanumeric (e.g. "wrpf")
  code          TEXT NOT NULL,           -- original casing from CSV (e.g. "WRPF")
  parent_slug   TEXT                     -- e.g. "ipf" for federations under it
);
CREATE INDEX idx_federations_parent ON federations (parent_slug);

CREATE TABLE lifters (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,           -- "John Haack", "John Smith #1"
  name_slug     TEXT NOT NULL UNIQUE,    -- "johnhaack", "johnsmith1"
  sex           TEXT,                    -- M / F / Mx
  -- room for metadata we add ourselves:
  instagram     TEXT,
  country       TEXT,
  state         TEXT
);

CREATE VIRTUAL TABLE lifters_fts USING fts5(
  name,
  content='lifters', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2',
  prefix='2 3'
);

CREATE TABLE meets (
  id              INTEGER PRIMARY KEY,
  federation_id   INTEGER NOT NULL REFERENCES federations(id),
  date            TEXT NOT NULL,         -- ISO 8601
  meet_name       TEXT NOT NULL,
  meet_slug       TEXT NOT NULL,         -- nameToSlug(meet_name)
  meet_country    TEXT,
  meet_state      TEXT,
  sanctioned      INTEGER NOT NULL DEFAULT 0,  -- boolean
  UNIQUE (federation_id, date, meet_slug)
);
CREATE INDEX idx_meets_date ON meets (date);
CREATE INDEX idx_meets_fed_date ON meets (federation_id, date);

CREATE VIRTUAL TABLE meets_fts USING fts5(
  meet_name,
  content='meets', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2',
  prefix='2 3'
);

CREATE TABLE lifts (
  id                  INTEGER PRIMARY KEY,
  lifter_id           INTEGER NOT NULL REFERENCES lifters(id),
  meet_id             INTEGER NOT NULL REFERENCES meets(id),
  event               TEXT NOT NULL,      -- SBD / BD / SD / SB / S / B / D
  equipment           TEXT NOT NULL,      -- Raw / Wraps / Single-ply / Multi-ply / Unlimited / Straps
  age                 REAL,
  age_class           TEXT,
  birth_year_class    TEXT,
  division            TEXT,
  bodyweight_kg       REAL,
  weight_class_kg     REAL,
  squat1_kg           REAL, squat2_kg REAL, squat3_kg REAL, squat4_kg REAL,
  bench1_kg           REAL, bench2_kg REAL, bench3_kg REAL, bench4_kg REAL,
  deadlift1_kg        REAL, deadlift2_kg REAL, deadlift3_kg REAL, deadlift4_kg REAL,
  best3_squat_kg      REAL,
  best3_bench_kg      REAL,
  best3_deadlift_kg   REAL,
  total_kg            REAL,
  place_rank          INTEGER,            -- 1, 2, 3, … (NULL for non-numeric)
  place_status        TEXT,               -- 'DQ' / 'DD' / 'G' / 'NS' (NULL if placed)
  dots                REAL,
  wilks               REAL,
  glossbrenner        REAL,
  goodlift            REAL,
  tested              INTEGER NOT NULL DEFAULT 0  -- boolean
);
CREATE INDEX idx_lifts_lifter ON lifts (lifter_id);
CREATE INDEX idx_lifts_meet ON lifts (meet_id);
CREATE INDEX idx_lifts_rankings_total ON lifts (event, equipment, weight_class_kg, total_kg DESC);
CREATE INDEX idx_lifts_rankings_dots ON lifts (event, equipment, dots DESC);

CREATE TABLE ingest_runs (
  id                   INTEGER PRIMARY KEY,
  started_at           TEXT NOT NULL,
  finished_at          TEXT,
  row_count            INTEGER,
  byte_size            INTEGER,
  source_last_modified TEXT,
  status               TEXT NOT NULL,   -- completed / skipped / failed
  error                TEXT
);
```

### Data normalizations applied at ingest

| Raw CSV value                    | Stored value                                                                |
| -------------------------------- | --------------------------------------------------------------------------- |
| `Name = "John Haack"`            | `lifters.name = "John Haack"`, `name_slug = "johnhaack"`                    |
| `Federation = "WRPF-UK"`         | `federations.code = "WRPF-UK"`, `slug = "wrpfuk"`                           |
| `MeetName = "WRPF AMERICAN PRO"` | `meets.meet_name = "WRPF AMERICAN PRO"`, `meet_slug = "wrpfamericanpro"`    |
| `Tested = "Yes"` / `""`          | `lifts.tested = 1` / `0`                                                    |
| `Sanctioned = "Yes"` / `"No"`    | `meets.sanctioned = 1` / `0`                                                |
| `Place = "1"`                    | `place_rank = 1`, `place_status = NULL`                                     |
| `Place = "DQ"`                   | `place_rank = NULL`, `place_status = "DQ"`                                  |
| `Date = "2024-05-12"`            | validated as `YYYY-MM-DD`; row skipped if malformed                         |
| Names with `Ā`, `é`, etc.        | `name` preserved; `name_slug` is NFKD + diacritic-strip + alphanumeric-only |

## Ingest pipeline (performance-focused)

The ingest is a single nightly job in `context.cron`. It must handle 3.9M rows in ~3-5 minutes inside one atomic transaction so readers see consistent state.

### Bypassing knex for the hot path

Knex's bulk-insert emits `INSERT … SELECT … UNION ALL SELECT …`, which hits SQLite's 32 766 bound-parameter ceiling fast. For ingest we go straight to `better-sqlite3`:

```ts
const insertLift = db.prepare(
  `INSERT INTO lifts (lifter_id, meet_id, event, equipment, age, ...) VALUES (@lifter_id, @meet_id, @event, @equipment, @age, ...)`,
);
const insertManyLifts = db.transaction((rows) => {
  for (const row of rows) insertLift.run(row);
});
```

Prepared statement + transaction is the standard better-sqlite3 fast-path: typical throughput is ~100k inserts/sec. 3.9M rows lands in 30-60 seconds of pure insert time.

### Pipeline stages

1. **Download.** Fetch the zip to a temp file. Compare `Last-Modified` against the last successful `ingest_runs` row; skip if unchanged unless `--force`.
2. **Stream-unzip + stream-parse CSV.** Never materialize the full file in RAM. `unzipper` for the zip stream, `csv-parse` (streaming mode) for rows. Memory stays bounded.
3. **First-pass aggregation in memory.** As rows stream in, build three lookup `Map`s:
   - `federationsByCode: Map<string, FederationDraft>`
   - `meetsByKey: Map<string, MeetDraft>` (key = `${federation_slug}|${date}|${meet_slug}`)
   - `liftersByNameSlug: Map<string, LifterDraft>`
     These dedupe automatically. Memory for ~989k lifters + 62k meets + 465 federations is well under 200 MB.
4. **Begin transaction.** Everything from here is atomic from a reader's view.
5. **Truncate target tables.** `DELETE FROM lifts; DELETE FROM meets; DELETE FROM lifters; DELETE FROM federations;` — fast in WAL mode.
6. **Insert federations** (small, ~465 rows). Capture each `id`.
7. **Insert lifters** in batches via prepared-statement transactions. Map `name_slug → lifter_id` for the next stage.
8. **Insert meets** in batches. Map `(federation_id, date, meet_slug) → meet_id`.
9. **Second pass over the CSV** (or buffered rows from pass 1 if memory permits): build lift rows with the right `lifter_id` / `meet_id` via the maps; bulk insert.
10. **Rebuild FTS.** `INSERT INTO lifters_fts(lifters_fts) VALUES('rebuild')`, same for `meets_fts`. FTS5 is ~5x faster rebuilt at end than maintained via triggers during bulk insert.
11. **Commit.** Readers see the new state.
12. **Record run.** Write to `ingest_runs` with row counts + duration + source `Last-Modified`.

### Why we do two passes

To assign FKs at row-level, we need lifter/meet IDs _before_ inserting lifts. Options:

- (a) Single pass, accumulate everything in memory, insert at the end. Simple, ~1 GB peak memory for the full CSV.
- (b) Two passes from a saved temp file. Lower memory (~200 MB), but disk I/O cost.
- (c) Single pass with progressive lifter/meet inserts and `RETURNING id` per row. Slow, lots of round trips.

**Pick (a)** if peak memory is OK on the deploy box (it should be — 1 GB transient is fine). Drop to (b) if not. Avoid (c).

### Atomicity

One transaction, single writer, WAL mode. Readers continue against the old snapshot for the duration of the ingest. Commit makes the new state visible. No DROP/RENAME swap dance needed.

### Cron + manual trigger

- Nightly at 04:00 UTC (after OpenPowerlifting's nightly publish, before US-morning traffic).
- `npm run ingest:run [-- --force]` for manual one-shot.
- Logs: start, finish, row count, duration, last-modified header. Failures log + alert, do not crash the process.

## How endpoints map (API contract preserved)

| Endpoint                           | Query (sketch)                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| `/api/users/{slug}`                | `lifters WHERE name_slug = ?` → join `lifts` for history                      |
| `/api/users?search=q`              | `lifters_fts MATCH '<tokens>*'` → return lifters                              |
| `/api/users/{slug}/progression`    | profile query → derive in JS                                                  |
| `/api/users/{slug}/personal-bests` | profile query → derive in JS                                                  |
| `/api/users/compare`               | two lifter lookups → derive in JS                                             |
| `/api/rankings[...]`               | `lifts JOIN lifters JOIN meets WHERE … ORDER BY <sort_col>`                   |
| `/api/meets/{fed}/{date}/{slug}`   | `meets WHERE federation_id = ? AND date = ? AND meet_slug = ?` → join `lifts` |
| `/api/federations`                 | `meets ORDER BY date DESC` joined to `federations`                            |
| `/api/federations/{slug}`          | `federations WHERE slug = ?` → join `meets`                                   |
| `/api/federations/{slug}/stats`    | aggregate `meets` by year, count                                              |
| `/api/records[...]`                | `lifts JOIN lifters JOIN meets WHERE … ROW_NUMBER() … per weight class`       |
| `/api/status`                      | unchanged (no data dependency)                                                |

All responses keep their existing shape. The change is **inside** each service: from "scrape + cache + parse" or "ROW_NUMBER over 3.9M rows" to "indexed lookup + small join."

## Phases

### Phase 1 — Schema + ingest pipeline

- Single migration creating all four tables, FTS, and `ingest_runs`.
- New `createIngestService(knex, logger)` using `better-sqlite3` directly for inserts.
- Wired into `context.cron` and `npm run ingest:run`.
- Integration tests against a small fixture CSV cover: row counts on all four tables, FK integrity, FTS hit, Place split, slug computation, boolean coercion, atomic swap behavior.

### Phase 2 — Endpoint migration

One commit per endpoint, in this order (smallest blast radius first):

1. `/api/users/{slug}` (and progression / personal-bests / compare / rank)
2. `/api/users?search=` (FTS5)
3. `/api/meets/{fed}/{date}/{slug}`
4. `/api/federations`
5. `/api/rankings`
6. `/api/records`

Each commit:

- Swap the service implementation.
- Keep API request/response shape stable.
- Update integration tests to seed the four tables in `test-setup` rather than mocking the scraper.
- Delete the scraper code paths that are no longer reachable.

### Phase 3 — Cleanup

- Drop the legacy `cache` table (if no consumers left).
- Delete dead scraper code (`createScraper.fetchHtml`, `parseHtml`, `tableToJson` — keep `fetchJson` only if `/api/status` still needs it).
- Update Swagger / docs to reflect the new `meet_code` URL convention.

## Open questions

- **Deploy disk:** target SQLite size is ~1.5–2 GB. Production volume needs to handle that plus WAL during ingest (transient ~3 GB peak). Need to confirm.
- **First production deploy:** the first ingest takes 3-5 minutes. Either deploy with the migration disabled and trigger ingest manually, or block startup until the first ingest completes.
- **Backups:** SQLite snapshot strategy needs to be defined separately. Recommend nightly `VACUUM INTO` to a separate file before each ingest.
- **OPL CSV schema changes:** they could add/remove columns. Ingest needs to be defensive — log unknown columns, default-NULL missing ones, alert if expected columns disappear.

## Out of scope

- Editing user-provided data (read-only API mirroring OPL).
- Computing scoring formulae (already in CSV).
- Sub-day data freshness (nightly matches upstream cadence).
- Backporting older CSV snapshots (only the latest is ingested).
