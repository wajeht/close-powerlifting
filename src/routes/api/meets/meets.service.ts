import { JSDOM } from "jsdom";

import cache from "../../../db/cache";
import { fetchHtml } from "../../../utils/http";
import { tableToJson } from "../../../utils/helpers";
import { GetMeetParamType, GetMeetQueryType } from "./meets.validation";

async function fetchMeet({ meet }: GetMeetParamType) {
  try {
    const html = await fetchHtml(`/m/${meet}`);
    const dom = new JSDOM(html);
    const elements = dom.window.document.getElementsByTagName("table")[0];
    const table = tableToJson(elements);
    return table;
  } catch {
    return null;
  }
}

export async function getMeet({
  meet,
  cache: useCache = true,
}: GetMeetParamType & GetMeetQueryType) {
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
  } catch {
    return null;
  }
}
