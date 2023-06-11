import { JSDOM } from 'jsdom';

import Axios from '../../utils/axios';
import { tableToJson } from '../../utils/helpers';
import { getRecordsType } from './records.validations';

const api = new Axios(true).instance();

export async function getRecords({ cache = true }: getRecordsType) {
  try {
    const html = await (await api.get('/records')).data;
    const dom = new JSDOM(html);

    const h2 = dom.window.document.getElementsByClassName('records-col');
    let data = [];

    for (const e of h2) {
      data.push({
        title: e.children[0].innerHTML,
        records: tableToJson(e.children[1]),
      });
    }

    return {
      data,
      cache,
    };
  } catch (e: any) {
    throw new Error(`Something went wrong while processing rankings data!`);
  }
}
