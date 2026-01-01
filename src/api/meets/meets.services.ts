import { AxiosError } from 'axios';
import { StatusCodes } from 'http-status-codes';
import { JSDOM } from 'jsdom';

import cache from '../../db/cache';
import Axios from '../../utils/axios';
import { tableToJson } from '../../utils/helpers';
import { getMeetParamType, getMeetQueryType } from './meets.validations';

const api = new Axios(true).instance();

async function fetchMeet({ meet }: getMeetParamType) {
  try {
    const html = await (await api.get(`/m/${meet}`)).data;
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

export async function getMeet({ meet, cache: useCache = true }: getMeetParamType & getMeetQueryType) {
  try {
    if (useCache === false) {
      return await fetchMeet({ meet });
    }

    const cachedData = await cache.get(`meet-${meet}`);
    let cachedMeet = cachedData ? JSON.parse(cachedData) : null;

    if (!cachedMeet) {
      cachedMeet = await fetchMeet({ meet });
      await cache.set(`meet-${meet}`, JSON.stringify(cachedMeet));
    }

    return cachedMeet;
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
