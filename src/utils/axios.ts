import axios, { AxiosInstance } from 'axios';
import { API_URL, BASE_URL } from '../config/constants';

class Axios {
  private API_URL: string = API_URL!;

  private BASE_URL: string = BASE_URL!;

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
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        Host: API_URL?.slice(API_URL.indexOf('www'), API_URL.lastIndexOf('/')),
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:88.0) Gecko/20100101 Firefox/88.0',
        Pragma: 'no-cache',
        TE: 'Trailers',
        'Upgrade-Insecure-Requests': 1,
      },
    });

    return instance;
  }
}

export default Axios;
