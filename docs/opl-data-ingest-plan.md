# OpenPowerlifting Data Ingest Plan

## Problem

Close Powerlifting today is a scrape-and-cache proxy over OpenPowerlifting's HTML pages. Every novel query (different filter combination, different pagination, fuzzy athlete search) is a fresh upstream fetch + HTML parse + table-to-JSON conversion. The cache stores opaque JSON blobs keyed by request URL, which means:

- No aggregations, no filtering across cached entries, no FTS
- Cache misses are devastating: network fetch + DOM parse + serialize on the hot path
- A search for "John" and "Jon" are completely separate cache entries
- Cache is forever per current policy, so stale data accumulates with no good story for freshness
- Every optimization we make (UPSERT, linkedom, LRU, skip parse/stringify) is a workaround for not owning the data

## Goal

Stop being a proxy. Become a database. Ingest OpenPowerlifting's published bulk CSV nightly into our own normalized SQLite tables, with proper indexes and FTS5 for athlete/meet search. Every API endpoint becomes a local SQL query — sub-millisecond response, no upstream dependency on the read path, no parse cost, no cache layer needed.

## Data

Source: [openpowerlifting.gitlab.io/opl-csv/bulk-csv.html](https://openpowerlifting.gitlab.io/opl-csv/bulk-csv.html)

- **Download URL:** `https://openpowerlifting.gitlab.io/opl-csv/files/openpowerlifting-latest.zip`
- **Size:** 158 MB zipped (~700–900 MB unzipped)
- **Rows:** ~3.9 million (one row per lifter per event per meet)
- **Update frequency:** Nightly
- **Format:** Single CSV, ~30 columns, explicitly intended for downstream use (CC0 / ODbL)

### CSV columns (mapped to our schema)

| CSV column                                  | Type | Notes                                                |
| ------------------------------------------- | ---- | ---------------------------------------------------- |
| Name                                        | TEXT | Lifter name, includes disambiguation numbers         |
| Sex                                         | TEXT | M, F, Mx                                             |
| Event                                       | TEXT | SBD, BD, SD, SB, S, B, D                             |
| Equipment                                   | TEXT | Raw, Wraps, Single-ply, Multi-ply, Unlimited, Straps |
| Age                                         | REAL | Exact or n+0.5 for approximate                       |
| AgeClass                                    | TEXT | e.g. "40-44"                                         |
| BirthYearClass                              | TEXT | IPF-style                                            |
| Division                                    | TEXT | Free-form                                            |
| BodyweightKg                                | REAL | 2 decimals                                           |
| WeightClassKg                               | REAL | 2 decimals                                           |
| Squat1Kg..Squat4Kg                          | REAL | Attempts; negative = failed                          |
| Bench1Kg..Bench4Kg                          | REAL | Attempts; negative = failed                          |
| Deadlift1Kg..Deadlift4Kg                    | REAL | Attempts; negative = failed                          |
| Best3SquatKg, Best3BenchKg, Best3DeadliftKg | REAL | Best of first three                                  |
| TotalKg                                     | REAL | Sum of three best lifts                              |
| Place                                       | TEXT | Position, or G/DQ/DD/NS                              |
| Dots, Wilks, Glossbrenner, Goodlift         | REAL | Scoring formulae                                     |
| Tested                                      | TEXT | "Yes" or empty                                       |
| Country, State                              | TEXT | Lifter origin                                        |
| Federation, ParentFederation                | TEXT | Hosting + sanctioning                                |
| Date                                        | TEXT | ISO 8601 YYYY-MM-DD                                  |
| MeetCountry, MeetState, MeetName            | TEXT | Meet location/name                                   |
| Sanctioned                                  | TEXT | Yes/No                                               |

## Target Footprint

- Raw CSV unzipped: ~700–900 MB
- Loaded into SQLite with appropriate indexes: ~1.0–1.5 GB
- FTS5 index on (Name, MeetName): +200–400 MB
- **Total SQLite DB: ~1.5–2 GB.** Fits trivially on any modest server.

## Schema

One main `lifts` table holding every row from the CSV. We do **not** normalize lifters/meets into separate tables in phase 1 — the CSV row IS the unit of truth, and queries are simpler against a flat table. We can normalize later if storage or update cost becomes a problem.

```sql
CREATE TABLE lifts (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL,
  sex             TEXT,
  event           TEXT,
  equipment       TEXT,
  age             REAL,
  age_class       TEXT,
  birth_year_class TEXT,
  division        TEXT,
  bodyweight_kg   REAL,
  weight_class_kg REAL,
  squat1_kg       REAL, squat2_kg REAL, squat3_kg REAL, squat4_kg REAL,
  bench1_kg       REAL, bench2_kg REAL, bench3_kg REAL, bench4_kg REAL,
  deadlift1_kg    REAL, deadlift2_kg REAL, deadlift3_kg REAL, deadlift4_kg REAL,
  best3_squat_kg  REAL,
  best3_bench_kg  REAL,
  best3_deadlift_kg REAL,
  total_kg        REAL,
  place           TEXT,
  dots            REAL,
  wilks           REAL,
  glossbrenner    REAL,
  goodlift        REAL,
  tested          TEXT,
  country         TEXT,
  state           TEXT,
  federation      TEXT,
  parent_federation TEXT,
  date            TEXT NOT NULL,        -- ISO 8601
  meet_country    TEXT,
  meet_state      TEXT,
  meet_name       TEXT,
  sanctioned      TEXT
);
```

### Indexes

```sql
-- Athlete lookup
CREATE INDEX idx_lifts_name ON lifts (name);

-- Date range queries / latest meets
CREATE INDEX idx_lifts_date ON lifts (date);

-- Common rankings filter combinations
CREATE INDEX idx_lifts_rankings ON lifts (sex, equipment, weight_class_kg, total_kg DESC);
CREATE INDEX idx_lifts_dots ON lifts (sex, equipment, dots DESC);

-- Federation drill-down
CREATE INDEX idx_lifts_federation ON lifts (federation, date);

-- Meet results
CREATE INDEX idx_lifts_meet ON lifts (meet_name, date);
```

Index list is a first cut — we tune based on actual query plans (`EXPLAIN QUERY PLAN`) once endpoints are wired up.

### FTS5 search

```sql
CREATE VIRTUAL TABLE lifts_fts USING fts5(
  name,
  meet_name,
  content='lifts',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 2',
  prefix='2 3'
);
```

Populated and kept in sync via triggers (per the bang pattern in `~/Dev/bang/src/db/migrations/20260515120000_add_fts_search_indexes.ts`).

## Ingest Pipeline

Scheduled job (`context.cron`) runs nightly at 04:00 UTC (after OpenPowerlifting's nightly publish, before US morning traffic):

1. **Download** `openpowerlifting-latest.zip` to a tmp file. Skip if `Last-Modified` matches stored value.
2. **Unzip** to streaming CSV reader. Don't materialize the full file in memory.
3. **Ingest into a staging table** (`lifts_new`) using batched `INSERT` (e.g. 1000 rows per transaction). Disable FTS triggers during bulk load.
4. **Build indexes** on `lifts_new` after the bulk insert (faster than indexing while inserting).
5. **Populate FTS** from `lifts_new` in one shot.
6. **Atomic swap:** `DROP TABLE lifts; ALTER TABLE lifts_new RENAME TO lifts;` inside a transaction. Reads continue from the old table until the swap completes.
7. **VACUUM** weekly (not nightly) to reclaim space.
8. **Log** row counts, duration, byte size to a small `ingest_runs` table for observability.

Expected ingest time: 30 seconds to 2 minutes depending on disk + index strategy.

## API Endpoint Migration

Each endpoint moves from `scraper.withCache(...)` to a direct SQL query. The route handlers stay the same; we swap out the service implementation.

| Endpoint                  | Today                        | After                                                                |
| ------------------------- | ---------------------------- | -------------------------------------------------------------------- |
| `/api/rankings`           | Scrape + parse rankings HTML | `SELECT ... FROM lifts WHERE ... ORDER BY ... LIMIT`                 |
| `/api/users/{name}`       | Scrape lifter profile page   | `SELECT * FROM lifts WHERE name = ? ORDER BY date`                   |
| `/api/users?search=`      | Scrape rankings search JSON  | `SELECT DISTINCT name FROM lifts_fts(?)`                             |
| `/api/meets/{fed}/{code}` | Scrape meet results page     | `SELECT * FROM lifts WHERE meet_name = ? AND date = ?`               |
| `/api/federations`        | Scrape federation index page | `SELECT DISTINCT federation FROM lifts` (cached in memory)           |
| `/api/records`            | Scrape records pages         | `SELECT name, MAX(best3_squat_kg) FROM lifts WHERE ... GROUP BY ...` |
| `/api/status`             | Internal — keep as is        | Add `last_ingest_at` from `ingest_runs`                              |

The existing `cache` table stays for the transition. We can decommission it later, or repurpose it as an HTTP-level response cache (small, short TTL) if request-level memoization helps.

## Phases

### Phase 1 — Ingest infrastructure (no user-visible change)

- New migration: create `lifts`, `lifts_fts`, `ingest_runs` tables
- Implement `createIngestService(context)` with download + parse + bulk insert + atomic swap
- Wire into `context.cron` as a nightly job
- Add `npm run ingest:run` for manual triggering
- Tests: small fixture CSV (~100 rows) through the full pipeline

### Phase 2 — Endpoint migration (one at a time, behind feature flag)

- Start with `/api/users/{name}` — simplest query, smallest blast radius
- Then `/api/rankings` — highest traffic, biggest perf win
- Then `/api/users?search=` — unlocks real FTS, biggest UX win
- Then `/api/meets`, `/api/records`, `/api/federations`
- Each migration keeps the scraper fallback wired up behind a flag, so we can flip back if a query is wrong

### Phase 3 — Cleanup

- Remove scraper-based service code for migrated endpoints
- Delete the `cache` table (or keep for HTTP response cache)
- Update `/api/status` to expose ingest health
- Update docs (swagger description, README)

## Tradeoffs / Risks

- **Disk:** 1.5–2 GB on the server. Need to check production volume size.
- **Ingest failure:** If a nightly run fails, we serve yesterday's data. Surface this in `/api/status` and alert on N consecutive failures.
- **Atomic swap window:** During the rename, there's a brief moment readers might see an empty/old table. SQLite's transaction guarantees should make this invisible, but worth load-testing.
- **Schema drift:** OpenPowerlifting could add/remove columns. Ingest needs to be defensive — skip unknown columns, default-null missing ones, log changes.
- **Initial backfill:** First production deploy needs to download + ingest the full dataset before serving. Plan for a one-time bootstrap, not a hot rolling deploy.
- **CSV quirks:** Lifter disambiguation numbers in `Name` field, mixed types in `Place` (numeric vs G/DQ/DD/NS), trailing decimals in numeric fields. Need to handle these in the parser, not in the queries.
- **Existing API consumers:** Response shapes must stay stable. We test each migrated endpoint against fixtures captured from the current scraper path.

## Open Questions

- Where does the SQLite file live in production? Same volume as today's? Backup story?
- Do we want a Postgres path eventually, or is SQLite enough at this scale? (Probably SQLite for now — single-machine, read-heavy, fits in RAM.)
- Should we preserve OpenPowerlifting's data versioning (their git history of changes)? Probably no — we only need the latest snapshot per nightly cycle.
- For `/api/users/{name}`, OpenPowerlifting includes social links (Instagram) by scraping the profile page HTML. The CSV doesn't have these. Either drop the field from the response or keep a thin scrape pass for profile-specific data not in the dump.

## Not in Scope

- Building our own scoring formulae (Dots/Wilks/etc.) — they're in the CSV.
- Real-time ingest (sub-day freshness). Nightly is fine and matches the upstream cadence.
- Writeable API (athletes editing their data). Read-only, mirrors upstream.
- Federation-specific endpoints beyond what we expose today.
