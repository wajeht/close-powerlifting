# Close Powerlifting

[![Node.js CI](https://github.com/wajeht/close-powerlifting/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/wajeht/close-powerlifting/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/ISC)
[![Open Source Love svg1](https://badges.frapsoft.com/os/v1/open-source.svg?v=103)](https://github.com/wajeht/close-powerlifting)

An intuitive REST API for the OpenPowerlifting dataset.

## API Endpoints

| Endpoint                       | Description                                                              |
| ------------------------------ | ------------------------------------------------------------------------ |
| `GET /api/rankings`            | Global rankings with flexible query filters and scoring                  |
| `GET /api/rankings/filter/...` | Cumulative filters: equipment / sex / weight-class / year / event / sort |
| `GET /api/federations`         | Federation list + per-federation meet history + per-year stats           |
| `GET /api/meets`               | Meet index + individual meet results / highlights                        |
| `GET /api/records`             | Top-3 records by equipment, weight class, sex (optional `?age_class=`)   |
| `GET /api/users`               | Athlete search, profile, personal-bests, progression, rank, compare      |
| `GET /api/status`              | Snapshot freshness + dataset counts                                      |
| `GET /api/health-check`        | Liveness probe (returns 200 once the SQLite snapshot is open)            |
| `GET /docs/api`                | Interactive Swagger UI                                                   |
| `GET /docs/api.json`           | Auto-generated OpenAPI 3.1 spec                                          |

Full request parameters, filters, and response shapes are documented at [closepowerlifting.com/docs/api](https://closepowerlifting.com/docs/api).

## Quick start

No keys, no headers, no signup:

```bash
curl 'https://closepowerlifting.com/api/rankings?per_page=1&units=kg'
```

Example response; rankings and counts change with snapshot updates:

```json
{
  "status": "success",
  "request_url": "https://closepowerlifting.com/api/rankings?per_page=1&units=kg",
  "message": "The resource was returned successfully!",
  "data": [
    {
      "rank": 1,
      "username": "deanatollefson",
      "name": "Deana Tollefson",
      "sex": "F",
      "age": 37,
      "bodyweight": 83.2,
      "weight_class_kg": 90,
      "weight_class_over": false,
      "tested": false,
      "equipment": "Multi-ply",
      "event": "SBD",
      "squat": 365,
      "bench": 237.5,
      "deadlift": 282.5,
      "total": 885,
      "dots": 818.06,
      "wilks": 793.01,
      "glossbrenner": 693.75,
      "goodlift": 139.71,
      "federation": "WPO",
      "meet_path": "wpo/2024-10-11/profinals",
      "meet_name": "Pro Finals",
      "meet_date": "2024-10-11",
      "country": "USA",
      "units": "kg"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 1,
    "items": 968693,
    "pages": 968693,
    "first_page": 1,
    "last_page": 968693,
    "from": 1,
    "to": 1
  }
}
```

Add `?pretty` to any endpoint for indented JSON output, or `?units=lbs` (default) / `?units=kg` to switch unit systems.

Weight classes keep their numeric `weight_class_kg` boundary and include a
`weight_class_over` flag: `84` is `{ "weight_class_kg": 84, "weight_class_over": false }`,
while `84+` has the same boundary with `weight_class_over: true`. Encode `+` as
`%2B` in URLs, for example `/api/rankings?weight_class=84%2B`, or in a ranking or
records weight-class path to select the open-ended class.

Rankings support DOTS, Wilks, Glossbrenner, Goodlift, total, squat, bench, and
deadlift sorting. Unsupported sorts such as `by-mcculloch` return HTTP 400.

### Ranking filters

Combine any of these query parameters on `/api/rankings`; omitted filters include
all matching entries. Each athlete appears once, using their best result **within
the selected filters**. The default sort is `by-dots`.

```bash
curl 'https://closepowerlifting.com/api/rankings?equipment=raw&sex=women&tested=true&country=USA&sort=by-total&per_page=10&units=kg'
```

| Parameter      | Values                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| `equipment`    | `raw`, `wraps`, `raw-wraps`, `single-ply`, `multi-ply`, `unlimited`                                        |
| `sex`          | `men`, `women`                                                                                             |
| `weight_class` | A class boundary, such as `84`, `82.5`, or `84%2B` for 84+                                                 |
| `year`         | Four digits, such as `2024`                                                                                |
| `event`        | `full-power`, `push-pull`, `squat`, `bench`, `deadlift`                                                    |
| `sort`         | `by-dots`, `by-wilks`, `by-glossbrenner`, `by-goodlift`, `by-total`, `by-squat`, `by-bench`, `by-deadlift` |
| `age_class`    | An age-class label, such as `24-34` or `40-44`                                                             |
| `federation`   | A federation slug, such as `ipf`                                                                           |
| `country`      | Exact athlete country from the dataset, case-insensitive; this is not the meet location                    |
| `tested`       | `true` or `false`, matching the entry's OPL tested flag                                                    |
| `current_page` | Page number, starting at `1`                                                                               |
| `per_page`     | Results per page, default `100`, maximum `500`                                                             |
| `units`        | `lbs` (default) or `kg` for weight fields; weight-class boundaries always stay in kg                       |

`tested=false` selects entries without the tested flag; omitting it includes both.
Ranking results expose the athlete's `country` and boolean `tested` flag. The
existing `/api/rankings/filter/...` URLs continue to work and also accept
`country` and `tested` query filters.

### Browser access

The public API supports browser requests from any origin. Requests are anonymous;
use the default `fetch` credentials setting or `credentials: "omit"`.
Cross-origin requests with `credentials: "include"` are not supported.

```js
const response = await fetch("https://closepowerlifting.com/api/rankings?per_page=10&units=kg", {
  credentials: "omit",
});
const payload = await response.json();
console.log(payload.data);
```

CORS preflights allow `GET`, `HEAD`, and `OPTIONS`. Browser JavaScript can read
`ETag`, `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, and `X-Request-Id`
response headers. The existing per-IP rate limit still applies.
Conditional requests using `If-None-Match` also keep these headers on `304 Not Modified` responses.

## Docs

- [Development guide](./docs/getting-started.md) — clone, install, snapshot download, dev server
- [Contributing](./docs/contribution.md)

## Data attribution

This project uses data from the [OpenPowerlifting](https://www.openpowerlifting.org) project — a community service to create a permanent, open archive of the world's powerlifting data.

All competition data is contributed to the **Public Domain**. You can download a copy of the raw data at [data.openpowerlifting.org](https://data.openpowerlifting.org).

If you find this API useful, please consider [supporting OpenPowerlifting](https://www.patreon.com/join/openpowerlifting).

## License

Distributed under the MIT License © [wajeht](https://github.com/wajeht). See [LICENSE](./LICENSE) for more information.
