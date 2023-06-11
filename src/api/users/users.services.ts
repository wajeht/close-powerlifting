import { JSDOM } from 'jsdom';
import { tableToJson, stripHTML } from '../../utils/helpers';
import { getUserType, getUsersType } from './users.validations';
import { fetchRankings } from '../rankings/rankings.services';

import Axios from '../../utils/axios';

const api = new Axios(true).instance();

export async function getUser({ username }: getUserType) {
  try {
    const html = await (await api.get(`/u/${username}`)).data;
    const dom = new JSDOM(html);

    const div = dom.window.document.getElementsByClassName('mixed-content');
    return [
      {
        name: stripHTML(div[0].children[0].innerHTML),
        username,
        personal_best: tableToJson(div[0].children[2]),
        competition_results: tableToJson(div[0].children[4]),
      },
    ];
  } catch (e) {
    throw new Error(`Something went wrong while processing meets data!`);
  }
}

export async function searchUser({ search }: getUsersType) {
  try {
    const api = new Axios(false).instance();
    const { next_index } = await (await api.get(`/search/rankings?q=${search}&start=0`)).data;
    const rankings = await fetchRankings(
      `start=${next_index}&end=${next_index + 99}&lang=en&units=lbs`,
    );
    return rankings;
  } catch (e) {
    throw new Error(`Something went wrong while processing meets data!`);
  }
}
