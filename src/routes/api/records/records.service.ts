import { AxiosError } from "axios";
import { StatusCodes } from "http-status-codes";
import { JSDOM } from "jsdom";

import Axios from "../../../utils/axios";
import { tableToJson } from "../../../utils/helpers";
import { GetRecordsType } from "./records.validation";

const api = new Axios(true).instance();

export async function getRecords({ cache = true }: GetRecordsType) {
  try {
    const html = await (await api.get("/records")).data;
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
