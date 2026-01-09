# 🏋🏻 Close Powerlifting

[![Node.js CI](https://github.com/wajeht/close-powerlifting/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/wajeht/close-powerlifting/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/ISC)
[![Open Source Love svg1](https://badges.frapsoft.com/os/v1/open-source.svg?v=103)](https://github.com/wajeht/close-powerlifting)

An intuitive REST API for the OpenPowerlifting database.

## 📃 API Endpoints

| Endpoint            | Description                                                 |
| ------------------- | ----------------------------------------------------------- |
| `/api/rankings`     | Global powerlifting rankings sorted by DOTS score           |
| `/api/federations`  | Powerlifting federation data and meet results               |
| `/api/meets`        | Individual competition/meet results with attempt data       |
| `/api/records`      | All-time powerlifting records by equipment and weight class |
| `/api/users`        | Athlete profiles and competition history                    |
| `/api/status`       | Data source status and statistics (no auth required)        |
| `/api/health-check` | API health monitoring (no auth required)                    |

Full API documentation available at [closepowerlifting.com/docs/api](https://closepowerlifting.com/docs/api)

## 🔐 Authentication

All endpoints except `/api/status` and `/api/health-check` require an API key:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" https://closepowerlifting.com/api/rankings
```

Request an API key at [closepowerlifting.com](https://closepowerlifting.com)

## 📦 Example Response

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" "https://closepowerlifting.com/api/rankings?per_page=100&current_page=1"
```

```json
{
  "status": "success",
  "request_url": "/api/rankings",
  "message": "The resource was returned successfully!",
  "data": [
    {
      "rank": 1,
      "full_name": "John Haack",
      "username": "johnhaack",
      "user_profile": "/api/users/johnhaack"
    }
  ],
  "pagination": {
    "items": 415567,
    "pages": 4155,
    "per_page": 100,
    "current_page": 1,
    "last_page": 4155,
    "first_page": 1,
    "from": 0,
    "to": 100
  }
}
```

## 📑 Docs

- See [DEVELOPMENT](./docs/getting-started.md) for `development` guide.
- See [CONTRIBUTION](./docs/contribution.md) for `contribution` guide.

## 📊 Data Attribution

This project uses data from the [OpenPowerlifting](https://www.openpowerlifting.org) project, a community service to create a permanent, open archive of the world's powerlifting data.

All competition data is contributed to the **Public Domain**. You can download a copy of the raw data at [data.openpowerlifting.org](https://data.openpowerlifting.org).

If you find this API useful, please consider [supporting OpenPowerlifting](https://www.patreon.com/join/openpowerlifting).

## 📜 License

Distributed under the MIT License © [wajeht](https://github.com/wajeht). See [LICENSE](./LICENSE) for more information.
