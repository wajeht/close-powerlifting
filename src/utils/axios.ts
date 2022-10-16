import axios from 'axios';
import { BASE_URL } from '../config/constants';

const instance = axios.create({
  baseURL: BASE_URL,
  headers: {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    Host: BASE_URL?.slice(BASE_URL.indexOf('www')),
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:88.0) Gecko/20100101 Firefox/88.0',
    Pragma: 'no-cache',
    TE: 'Trailers',
    'Upgrade-Insecure-Requests': 1,
  },
});

export default instance;
