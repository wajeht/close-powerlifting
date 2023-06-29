import { AxiosError } from 'axios';
import { StatusCodes } from 'http-status-codes';
import { JSDOM } from 'jsdom';

import Axios from '../../utils/axios';
import { tableToJson } from '../../utils/helpers';
// @ts-ignore
import redis from '../../utils/redis';
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

export async function getMeet({ meet, cache = true }: getMeetParamType & getMeetQueryType) {
  try {
    if (cache === false) {
      return await fetchMeet({ meet });
    }

    // @ts-ignore
    let cachedMeeet = JSON.parse(await redis.get(`meet-${meet}`));

    if (!cachedMeeet) {
      cachedMeeet = await fetchMeet({ meet });
      // @ts-ignore
      await redis.set(`meet-${meet}`, JSON.stringify(cachedMeeet));
    }

    return cachedMeeet;
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
