import { AxiosError } from 'axios';
import { StatusCodes } from 'http-status-codes';
import { JSDOM } from 'jsdom';

import Axios from '../../utils/axios';
import { tableToJson } from '../../utils/helpers';
import redis from '../../utils/redis';
import {
  getFederationsParamType,
  getFederationsQueryType,
  getFederationsType,
} from './federations.validations';

const api = new Axios(true).instance();

async function fetchFederations({ current_page, per_page }: any) {
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

export async function getFederations({ current_page = 1, per_page = 100, cache = true }) {
  try {
    if (cache === false) {
      const federations = await fetchFederations({ current_page, per_page });

      return {
        data: federations?.data,
        cache: true,
        pagination: {
          items: federations?.table.length,
          pages: Math.floor(federations?.table.length! / per_page),
          per_page,
          current_page,
          last_page: Math.floor(federations?.table.length! / per_page),
          first_page: 1,
          from: federations?.from,
          to: federations?.to,
        },
      };
    }

    const cacheKey = `close-powerlifting-federations-${current_page}-${per_page}`;

    let federations = JSON.parse((await redis.get(cacheKey)) as any);

    if (federations === null) {
      federations = await fetchFederations({ current_page, per_page });
      await redis.set(cacheKey, JSON.stringify(federations));
    }

    return {
      data: federations?.data,
      cache: true,
      pagination: {
        items: federations?.table.length,
        pages: Math.floor(federations?.table.length! / per_page),
        per_page,
        current_page,
        last_page: Math.floor(federations?.table.length! / per_page),
        first_page: 1,
        from: federations?.from,
        to: federations?.to,
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

async function fetchFederation({ federation, year }: any) {
  try {
    let url = '';
    if (year) {
      url = `/mlist/${federation}/${year}`;
    } else {
      url = `/mlist/${federation}`;
    }
    const html = await (await api.get(url)).data;
    const dom = new JSDOM(html);
    const elements = dom.window.document.getElementsByTagName('table')[0];
    const federations = tableToJson(elements);

    return federations;
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

export async function getFederation({
  federation,
  cache = true,
  year,
}: getFederationsParamType & getFederationsQueryType) {
  try {
    if (cache === false) {
      const federations = await fetchFederation({ federation, year });
      return {
        data: federations,
        cache,
      };
    }

    let cacheString = '';

    if (year) {
      cacheString = `close-powerlifting-federations-federation-${federation}-${year}`;
    } else {
      cacheString = `close-powerlifting-federations-federation-${federation}`;
    }

    let federations = JSON.parse((await redis.get(cacheString)) as any);

    if (federations === null) {
      federations = await fetchFederation({ federation, year });
      await redis.set(cacheString, JSON.stringify(federations));
    }

    return {
      data: federations,
      cache,
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
