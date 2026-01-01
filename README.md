# 🏋🏻 Close Powerlifting

[![Node.js CI](https://github.com/wajeht/close-powerlifting/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/wajeht/close-powerlifting/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/ISC)
[![Open Source Love svg1](https://badges.frapsoft.com/os/v1/open-source.svg?v=103)](https://github.com/wajeht/close-powerlifting)

An intuitive REST API for the OpenPowerlifting database.

## 📃 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/rankings` | Global powerlifting rankings sorted by DOTS score |
| `/api/federations` | Powerlifting federation data and meet results |
| `/api/meets` | Individual competition/meet results with attempt data |
| `/api/records` | All-time powerlifting records by equipment and weight class |
| `/api/users` | Athlete profiles and competition history |
| `/api/status` | Data source status and statistics (no auth required) |
| `/api/health-check` | API health monitoring (no auth required) |

Full API documentation available at [close-powerlifting.jaw.dev/docs/api](https://close-powerlifting.jaw.dev/docs/api)

## 🔐 Authentication

All endpoints except `/api/status` and `/api/health-check` require an API key:

```bash
# Using x-api-key header
curl -H "x-api-key: YOUR_API_KEY" https://close-powerlifting.jaw.dev/api/rankings

# Using Bearer token
curl -H "Authorization: Bearer YOUR_API_KEY" https://close-powerlifting.jaw.dev/api/rankings
```

Request an API key at [close-powerlifting.jaw.dev](https://close-powerlifting.jaw.dev)

## 📦 Example Response

```bash
curl -H "x-api-key: YOUR_API_KEY" "https://close-powerlifting.jaw.dev/api/rankings?per_page=100&current_page=1"
```

```json
{
  "status": "success",
  "request_url": "/api/rankings",
  "message": "The resource was returned successfully!",
  "cache": true,
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

Add `?cache=false` to bypass caching and get the latest data.

## 🛠️ Development

```bash
# Clone repository
git clone https://github.com/wajeht/close-powerlifting.git
cd close-powerlifting

# Setup environment
cp .env.example .env

# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm run test
```

## 📑 Documentation

- [Getting Started](./docs/getting-started.md)
- [Contribution Guide](./docs/contribution.md)
- [Code of Conduct](./docs/code-of-conduct.md)

## 📜 License

Distributed under the MIT License. See [LICENSE](./LICENSE) for more information.
