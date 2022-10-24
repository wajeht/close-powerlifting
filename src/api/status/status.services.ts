import { tableToJson, stripHTML } from '../../utils/helpers';
import { JSDOM } from 'jsdom';

import Axios from '../../utils/axios';
const api = new Axios(true).instance();

export async function getStatus() {
  try {
    const html = await (await api.get('/status')).data;
    const dom = new JSDOM(html);

    const div = dom.window.document.getElementsByClassName('text-content');

    return [
      {
        server_version: stripHTML(div[0].children[2].innerHTML),
        meets: div[0].childNodes[8].textContent?.toString(),
        federations: tableToJson(div[0].children[5]),
      },
    ];
  } catch (e) {
    throw new Error(`Something went wrong while processing rankings data!`);
  }
}
