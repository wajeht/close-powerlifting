import axios, { AxiosInstance } from "axios";

import { config } from "../config";

class Axios {
  private API_URL: string = config.app.apiUrl;

  private BASE_URL: string = config.app.baseUrl;

  public readonly scrape: boolean;

  constructor(scrape: boolean) {
    this.scrape = scrape;
  }

  private getCorrectURL(): string {
    if (this.scrape === true) {
      return this.BASE_URL;
    } else {
      return this.API_URL;
    }
  }

  public instance(): AxiosInstance {
    const instance = axios.create({
      baseURL: this.getCorrectURL(),
      headers: {
        Cookie: "units=lbs;",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Encoding": "application/json",
        Host: config.app.apiUrl?.slice(
          config.app.apiUrl.indexOf("www"),
          config.app.apiUrl.lastIndexOf("/"),
        ),
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:88.0) Gecko/20100101 Firefox/88.0",
        Pragma: "no-cache",
        TE: "Trailers",
        "Upgrade-Insecure-Requests": 1,
      },
    });

    return instance;
  }
}

export default Axios;
