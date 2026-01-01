import { AxiosError } from "axios";
import { StatusCodes } from "http-status-codes";
import { JSDOM } from "jsdom";

import Axios from "../../../utils/axios";
import { stripHTML, tableToJson } from "../../../utils/helpers";
import { fetchRankings } from "../rankings/rankings.service";
import { GetUserType, GetUsersType } from "./users.validation";

const api = new Axios(true).instance();

export async function getUser({ username }: GetUserType) {
  try {
    const html = await (await api.get(`/u/${username}`)).data;
    const dom = new JSDOM(html);

    const div = dom.window.document.getElementsByClassName("mixed-content") as any;
    return [
      {
        name: stripHTML(div[0].children[0].innerHTML),
        username,
        personal_best: tableToJson(div[0].children[2]),
        competition_results: tableToJson(div[0].children[4]),
      },
    ];
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

export async function searchUser({ search }: GetUsersType) {
  try {
    const api = new Axios(false).instance();
    const { next_index } = await (await api.get(`/search/rankings?q=${search}&start=0`)).data;
    const rankings = await fetchRankings(
      `start=${next_index}&end=${next_index + 99}&lang=en&units=lbs`,
    );
    return rankings;
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
