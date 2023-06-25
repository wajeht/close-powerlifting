import { AxiosError } from 'axios';
import { StatusCodes } from 'http-status-codes';
import { JSDOM } from 'jsdom';

import Axios from '../../utils/axios';
import { tableToJson } from '../../utils/helpers';
// @ts-ignore
import redis from '../../utils/redis';
import { getFederationsType, getMeetsType } from './meets.validations';

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
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response?.status === StatusCodes.NOT_FOUND) {
        return null;
      }
    } else {
      throw error;
    }
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
      await redis.set(`close-powerlifting-meets`, JSON.stringify(meets));
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
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response?.status === StatusCodes.NOT_FOUND) {
        return null;
      }
    } else {
      throw error;
    }
  }
}

export async function getFederations({ federation }: getFederationsType) {
  try {
    const html = await (await api.get(`/mlist/${federation}`)).data;
    const dom = new JSDOM(html);
    const elements = dom.window.document.getElementsByTagName('table')[0];
    const table = tableToJson(elements);
    return table;
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response?.status === StatusCodes.NOT_FOUND) {
        return null;
      }
    } else {
      throw error;
    }
  }
}
