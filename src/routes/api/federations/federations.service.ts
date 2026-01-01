import { JSDOM } from "jsdom";

import cache from "../../../db/cache";
import { fetchHtml } from "../../../utils/http";
import { tableToJson } from "../../../utils/helpers";
import { GetFederationsParamType, GetFederationsQueryType } from "./federations.validation";

async function fetchFederations({ current_page, per_page }: any) {
  try {
    const html = await fetchHtml("/mlist");
    const dom = new JSDOM(html);
    const elements = dom.window.document.getElementsByTagName("table")[0];
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
  } catch {
    return null;
  }
}

export async function getFederations({ current_page = 1, per_page = 100, cache: useCache = true }) {
  try {
    if (useCache === false) {
      const federations = await fetchFederations({ current_page, per_page });

      return {
        data: federations?.data,
        cache: true,
        pagination: {
          items: federations?.table.length,
          pages: Math.floor(federations!.table.length / per_page),
          per_page,
          current_page,
          last_page: Math.floor(federations!.table.length! / per_page),
          first_page: 1,
          from: federations?.from,
          to: federations?.to,
        },
      };
    }

    const cacheKey = `close-powerlifting-federations-${current_page}-${per_page}`;

    const cachedFederations = await cache.get(cacheKey);
    let federations = cachedFederations ? JSON.parse(cachedFederations) : null;

    if (federations === null) {
      federations = await fetchFederations({ current_page, per_page });
      await cache.set(cacheKey, JSON.stringify(federations));
    }

    return {
      data: federations?.data,
      cache: true,
      pagination: {
        items: federations?.table.length,
        pages: Math.floor(federations.table.length! / per_page),
        per_page,
        current_page,
        last_page: Math.floor(federations.table.length! / per_page),
        first_page: 1,
        from: federations?.from,
        to: federations?.to,
      },
    };
  } catch {
    return null;
  }
}

async function fetchFederation({ federation, year }: any) {
  try {
    let url = "";
    if (year) {
      url = `/mlist/${federation}/${year}`;
    } else {
      url = `/mlist/${federation}`;
    }
    const html = await fetchHtml(url);
    const dom = new JSDOM(html);
    const elements = dom.window.document.getElementsByTagName("table")[0];
    const federations = tableToJson(elements);

    return federations;
  } catch {
    return null;
  }
}

export async function getFederation({
  federation,
  cache: useCache = true,
  year,
}: GetFederationsParamType & GetFederationsQueryType) {
  try {
    if (useCache === false) {
      const federations = await fetchFederation({ federation, year });
      return {
        data: federations,
        cache: useCache,
      };
    }

    let cacheString = "";

    if (year) {
      cacheString = `close-powerlifting-federations-federation-${federation}-${year}`;
    } else {
      cacheString = `close-powerlifting-federations-federation-${federation}`;
    }

    const cachedFederations = await cache.get(cacheString);
    let federations = cachedFederations ? JSON.parse(cachedFederations) : null;

    if (federations === null) {
      federations = await fetchFederation({ federation, year });
      await cache.set(cacheString, JSON.stringify(federations));
    }

    return {
      data: federations,
      cache: useCache,
    };
  } catch {
    return null;
  }
}
