import { JSDOM } from 'jsdom';
import { tableToJson, stripHTML } from '../../utils/helpers';
import { getUserType } from './users.validations';

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
    console.log(e);
    throw new Error(`Something went wrong while processing meets data!`);
  }
}
