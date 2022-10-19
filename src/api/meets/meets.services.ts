import { JSDOM } from 'jsdom';
import { tableToJson } from '../../utils/helpers';
import { getMeetsType } from './meets.validations';

import Axios from '../../utils/axios';
const api = new Axios(true).instance();

/**
 * It makes a request to the website, gets the HTML, parses the HTML, and returns the data in a JSON
 * format
 * @returns An array of objects.
 */
export async function getMeets({ current_page = 1, per_page = 100, cache = true }: getMeetsType) {
  try {
    const html = await (await api.get('/mlist')).data;
    const dom = new JSDOM(html);
    const elements = dom.window.document.getElementsByTagName('table')[0];
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
      cache: true,
      pagination: {
        items: table.length,
        pages: Math.floor(table.length / per_page),
        per_page,
        current_page,
        last_page: Math.floor(table.length / per_page),
        first_page: 1,
        from,
        to,
      },
    };
  } catch (e) {
    throw new Error(`Something went wrong while processing meets data!`);
  }
}
