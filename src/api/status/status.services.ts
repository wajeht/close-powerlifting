import { tableToJson, stripHTML } from '../../utils/helpers';
import { JSDOM } from 'jsdom';
// @ts-ignore
import redis from '../../utils/redis';
import { getStatusType } from './status.validations';

import Axios from '../../utils/axios';
const api = new Axios(true).instance();

export async function getStatus({ cache = true }: getStatusType) {
  try {
    // @ts-ignore
    let data = JSON.parse(await redis.get(`close-powerlifting-status`));

    if (data === null) {
      const html = await (await api.get('/status')).data;
      const dom = new JSDOM(html);
      const div = dom.window.document.getElementsByClassName('text-content');

      data = {
        server_version: stripHTML(div[0].children[2].innerHTML),
        meets: div[0].childNodes[8].textContent?.toString(),
        federations: tableToJson(div[0].children[5]),
      };

      // @ts-ignore
      const status = await redis.set(`close-powerlifting-status`, JSON.stringify(data));
    }

    return {
      cache,
      data,
    };
  } catch (e) {
    throw new Error(`Something went wrong while processing rankings data!`);
  }
}
