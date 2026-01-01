import { JSDOM } from "jsdom";

import { fetchApi, fetchHtml } from "../../../utils/http";
import { stripHTML, tableToJson } from "../../../utils/helpers";
import { fetchRankings } from "../rankings/rankings.service";
import { GetUserType, GetUsersType } from "./users.validation";

export async function getUser({ username }: GetUserType) {
  try {
    const html = await fetchHtml(`/u/${username}`);
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
  } catch {
    return null;
  }
}

export async function searchUser({ search }: GetUsersType) {
  try {
    const { next_index } = await fetchApi(`/search/rankings?q=${search}&start=0`);
    const rankings = await fetchRankings(
      `start=${next_index}&end=${next_index + 99}&lang=en&units=lbs`,
    );
    return rankings;
  } catch {
    return null;
  }
}
