import axios from 'axios';
import { AXIOS_HOST } from '../config/constants';

const instance = axios.create({
  headers: {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    Host: AXIOS_HOST,
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:88.0) Gecko/20100101 Firefox/88.0',
    Pragma: 'no-cache',
    TE: 'Trailers',
    'Upgrade-Insecure-Requests': 1,
  },
});

export default instance;
