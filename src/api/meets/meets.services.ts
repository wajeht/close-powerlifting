import { JSDOM } from 'jsdom';
import { tableToJson } from '../../utils/helpers';
import { getMeetsType } from './meets.validations';

import Axios from '../../utils/axios';
// @ts-ignore
import redis from '../../utils/redis';

const api = new Axios(true).instance();

async function fetchMeets({ current_page, per_page }: any) {
  try {
    const html = await (await api.get('/mlist')).data;
    const dom = new JSDOM(html);
    const elements = dom.window.document.getElementsByTagName('table')[0];
    const table = tableToJson(elements);

    let from;
    let to;

    if (current_page === 1) {
      from = 1;
      to = per_page;
    } else {
      from = current_page * per_page;
      to = current_page * per_page + per_page;
    }
    const slicedTable = table.slice(from, to);

    return {
      data: slicedTable,
      table,
      from,
      to,
    };
  } catch (e) {
    return null;
  }
}

export async function getMeets({ current_page = 1, per_page = 100, cache = true }: getMeetsType) {
  try {
    if (cache === false) {
      const meets = await fetchMeets({ current_page, per_page });

      return {
        data: meets?.data,
        cache: true,
        pagination: {
          items: meets?.table.length,
          pages: Math.floor(meets?.table.length! / per_page),
          per_page,
          current_page,
          last_page: Math.floor(meets?.table.length! / per_page),
          first_page: 1,
          from: meets?.from,
          to: meets?.to,
        },
      };
    }

    // @ts-ignore
    let meets = JSON.parse(await redis.get(`close-powerlifting-meets`));

    if (meets === null) {
      meets = await fetchMeets({ current_page, per_page });
      // @ts-ignore
      const m = await redis.set(`close-powerlifting-meets`, JSON.stringify(meets));
    }

    return {
      data: meets?.data,
      cache: true,
      pagination: {
        items: meets?.table.length,
        pages: Math.floor(meets?.table.length! / per_page),
        per_page,
        current_page,
        last_page: Math.floor(meets?.table.length! / per_page),
        first_page: 1,
        from: meets?.from,
        to: meets?.to,
      },
    };
  } catch (e) {
    throw new Error(`Something went wrong while processing meets data!`);
  }
}
