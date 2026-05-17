# Close Powerlifting

[![Node.js CI](https://github.com/wajeht/close-powerlifting/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/wajeht/close-powerlifting/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/ISC)
[![Open Source Love svg1](https://badges.frapsoft.com/os/v1/open-source.svg?v=103)](https://github.com/wajeht/close-powerlifting)

A public, anonymous REST API mirroring the OpenPowerlifting database in memory — no signup, no API keys, no rate-limit hassle.

## API Endpoints

| Endpoint                       | Description                                                              |
| ------------------------------ | ------------------------------------------------------------------------ |
| `GET /api/rankings`            | Global powerlifting rankings sorted by DOTS                              |
| `GET /api/rankings/filter/...` | Cumulative filters: equipment / sex / weight-class / year / event / sort |
| `GET /api/federations`         | Federation list + per-federation meet history + per-year stats           |
| `GET /api/meets`               | Meet index + individual meet results / highlights                        |
| `GET /api/records`             | Top-3 records by equipment, weight class, sex (optional `?age_class=`)   |
| `GET /api/users`               | Athlete search, profile, personal-bests, progression, rank, compare      |
| `GET /api/status`              | Snapshot freshness + dataset counts                                      |
| `GET /api/health-check`        | Liveness probe (returns 200 once the in-memory store is ready)           |
| `GET /docs/api`                | Interactive Swagger UI                                                   |
| `GET /docs/api.json`           | Auto-generated OpenAPI 3.1 spec                                          |

Full request parameters, filters, and response shapes are documented at [closepowerlifting.com/docs/api](https://closepowerlifting.com/docs/api).

## Quick start

No keys, no headers, no signup:

```bash
curl 'https://closepowerlifting.com/api/rankings?per_page=2&units=kg'
```

```json
{
  "status": "success",
  "request_url": "https://closepowerlifting.com/api/rankings?per_page=2&units=kg",
  "message": "The resource was returned successfully!",
  "data": [
    {
      "rank": 1,
      "username": "deanatollefson",
      "name": "Deana Tollefson",
      "sex": "F",
      "age": null,
      "bodyweight": 83.2,
      "weight_class_kg": 90,
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
    "per_page": 2,
    "items": 954614,
    "pages": 477307,
    "first_page": 1,
    "last_page": 477307,
    "from": 1,
    "to": 2
  }
}
```

Add `?pretty` to any endpoint for indented JSON output, or `?units=lbs` (default) / `?units=kg` to switch unit systems.

## Docs

- [Development guide](./docs/getting-started.md) — clone, install, snapshot download, dev server
- [Contributing](./docs/contribution.md)

## Data attribution

This project uses data from the [OpenPowerlifting](https://www.openpowerlifting.org) project — a community service to create a permanent, open archive of the world's powerlifting data.

All competition data is contributed to the **Public Domain**. You can download a copy of the raw data at [data.openpowerlifting.org](https://data.openpowerlifting.org).

If you find this API useful, please consider [supporting OpenPowerlifting](https://www.patreon.com/join/openpowerlifting).

## License

Distributed under the MIT License © [wajeht](https://github.com/wajeht). See [LICENSE](./LICENSE) for more information.
