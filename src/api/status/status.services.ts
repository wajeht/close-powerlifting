import { JSDOM } from 'jsdom';

import Axios from '../../utils/axios';
import { stripHTML, tableToJson } from '../../utils/helpers';
// @ts-ignore
import redis from '../../utils/redis';
import { getStatusType } from './status.validations';

const api = new Axios(true).instance();

export async function fetchStatus() {
  try {
    const html = await (await api.get('/status')).data;
    const dom = new JSDOM(html);
    const div = dom.window.document.getElementsByClassName('text-content');
    return {
      server_version: stripHTML(div[0].children[2].innerHTML),
      meets: div[0].childNodes[8].textContent?.toString(),
      federations: tableToJson(div[0].children[5]),
    };
  } catch (e) {
    return null;
  }
}

export async function getStatus({ cache = true }: getStatusType) {
  try {
    if (cache === false) {
      return {
        data: await fetchStatus(),
        cache,
      };
    }

    // @ts-ignore
    let data = JSON.parse(await redis.get(`close-powerlifting-status`));

    if (data === null) {
      data = await fetchStatus();
      // @ts-ignore
      await redis.set(`close-powerlifting-status`, JSON.stringify(data));
    }

    return {
      cache,
      data,
    };
  } catch (e) {
    throw new Error(`Something went wrong while processing rankings data!`);
  }
}
