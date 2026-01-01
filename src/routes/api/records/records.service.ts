import { JSDOM } from "jsdom";

import { fetchHtml } from "../../../utils/http";
import { tableToJson } from "../../../utils/helpers";
import { GetRecordsType } from "./records.validation";

export async function getRecords({ cache = true }: GetRecordsType) {
  try {
    const html = await fetchHtml("/records");
    const dom = new JSDOM(html);

    const h2 = dom.window.document.getElementsByClassName("records-col");
    const data = [];

    for (const e of h2) {
      data.push({
        title: e.children[0]!.innerHTML,
        records: tableToJson(e.children[1]),
      });
    }

    return {
      data,
      cache,
    };
  } catch {
    return null;
  }
}
