# 🏋🏻 Close Powerlifting

[![Node.js CI](https://github.com/wajeht/close-powerlifting/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/wajeht/close-powerlifting/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/ISC)
[![Open Source Love svg1](https://badges.frapsoft.com/os/v1/open-source.svg?v=103)](https://github.com/allkindsofgains/gains)

an intuitive api for open-powerlifting database

# 📚 Technologies

- **Node** with **Express** for API
- **Vitest** for unit testing, barely
- **JsDom** for scraping
- **MongoDB** because we only need to keep track of API keys
- **Redis** to cache some of the larger scraping data
- **Tailwind** for rapid styling
- **EJS** HTML template for server-side rendering
- and of course **Typescript** for everything ❤️

# 👨‍💻 Getting started

- [Development guide](https://github.com/wajeht/close-powerlifting/blob/main/docs/getting-started.md)
- [Contribution guide](https://github.com/wajeht/close-powerlifting/blob/main/docs/contribution.md)
- [Code of Conduct](https://github.com/wajeht/close-powerlifting/blob/main/docs/code-of-conduct.md)

# 📃 API endpoints

We have a few resources available for API calls. Resources with larger amounts of data are usually cached in memory and paginated for the first call. Pagination is included by default. You can pass in `?cache=false` at the end of a URL to get the latest/recent data.

- `/api/federations`
- `/api/meets`
- `/api/rankings`
- `/api/records`
- `/api/status`
- `/api/users`

All end-points are available via `https://close-powerlifting.jaw.dev/docs/api/`.

### Example call/response

```bash
$ curl https://close-powerlifting.jaw.dev/api/rankings
$ curl https://close-powerlifting.jaw.dev/api/rankings?per_page=100&current_page=1&cahe=false
```

```json
{
  "status": "success",
  "request_url": "/api/rankings",
  "message": "The resource was returned successfully!",
  "cache": true,
  "data": [
    {
      "id": 0,
      "rank": 1,
      "full_name": "waj het",
      "username": "wajeht",
      "user_profile": "/api/users/wajeht"
      // ...
    },
    {
      // ...
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

For more of API documentation, visit `https://close-powerlifting.jaw.dev` and request for `x-api-keys`.

# © License

Distributed under the MIT license © wajeht. See LICENSE for more information.
