<div align="center"><img src="https://raw.githubusercontent.com/wajeht/close-powerlifting/main/src/public/img/arnold.jpg"></div>

# <div align="center"> 🏋️‍♂️ Close Powerlifting </div>

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/ISC) [![Open Source Love svg1](https://badges.frapsoft.com/os/v1/open-source.svg?v=103)](https://github.com/allkindsofgains/gains)
</div>

<p align="center"> an intuitive api for open-powerlifting database </p>


# 📚 Technologies

- **Node** with **Express** for API
- **Vitest** for unit testing
- **JsDom** for scraping
- **Redis** to cache some of larger scraping data
- **Tailwind** for rapid styling
- **EJS** html template for server side rendering
- and of course **Typescript** for everything ❤️


# 👨‍💻 Getting started

- [Development guide](https://github.com/wajeht/close-powerlifting/blob/main/docs/getting-started.md)
- [Contribution guide](https://github.com/wajeht/close-powerlifting/blob/main/docs/contribution.md)
- [Code of Conduct](https://github.com/wajeht/close-powerlifting/blob/main/docs/code-of-conduct.md)


# 📃 API end points
We have a few resources available for api call. Resources with larger amount of data are usually cached in memory and paginated for the first call. Pagination is included by default. You can pass in `?cache=false` at the end of a url to get the latest/recent data.


- `/api/meets`
- `/api/rankings`
- `/api/records`
- `/api/status`
- `/api/users`

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
  "from": 100,
  "to": 200
  }
}
```

For more of api documentation, visit `https://close-powerlifting.jaw.dev` and request for `x-api-keys`.


# © License

Distributed under the MIT license © wajeht. See LICENSE for more information.
