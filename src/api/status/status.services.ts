import { JSDOM } from "jsdom";

import cache from "../../db/cache";
import Axios from "../../utils/axios";
import { stripHTML, tableToJson } from "../../utils/helpers";
import { getStatusType } from "./status.validations";

const api = new Axios(true).instance();

export async function fetchStatus() {
  try {
    const html = await (await api.get("/status")).data;
    const dom = new JSDOM(html);
    const div = dom.window.document.getElementsByClassName("text-content") as any;
    return {
      server_version: stripHTML(div[0].children[2].innerHTML),
      meets: div[0].childNodes[8].textContent?.toString(),
      federations: tableToJson(div[0].children[5]),
    };
  } catch (_e) {
    return null;
  }
}

export async function getStatus({ cache: useCache = true }: getStatusType) {
  try {
    if (useCache === false) {
      return {
        data: await fetchStatus(),
        cache: useCache,
      };
    }

    const cachedData = await cache.get(`close-powerlifting-status`);
    let data = cachedData ? JSON.parse(cachedData) : null;

    if (data === null) {
      data = await fetchStatus();
      await cache.set(`close-powerlifting-status`, JSON.stringify(data));
    }

    return {
      cache: useCache,
      data,
    };
  } catch (_e) {
    throw new Error(`Something went wrong while processing rankings data!`);
  }
}
