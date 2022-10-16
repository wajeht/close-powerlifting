import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { JSDOM } from 'jsdom';

import axios from 'axios';
import { BASE_URL, API } from '../../config/constants';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    Host: API?.slice(API.indexOf('www'), API.lastIndexOf('/')),
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:88.0) Gecko/20100101 Firefox/88.0',
    Pragma: 'no-cache',
    TE: 'Trailers',
    'Upgrade-Insecure-Requests': 1,
  },
});

// TODO!: refactor this into a service file
export async function getMeets(req: Request, res: Response) {
  const html = await (await api.get('/mlist')).data;
  const dom = new JSDOM(html);

  // @ts-ignore
  const table = dom.window.document.getElementsByTagName('table')[0];

  // @ts-ignore
  function tableToJson(table) {
    var data = [];

    // first row needs to be headers
    var headers = [];
    for (var i = 0; i < table.rows[0].cells.length; i++) {
      headers[i] = table.rows[0].cells[i].innerHTML.toLowerCase().replace(/ /gi, '');
    }

    // go through cells
    for (var i = 1; i < table.rows.length; i++) {
      var tableRow = table.rows[i];
      var rowData = {};

      for (var j = 0; j < tableRow.cells.length; j++) {
        // @ts-ignore
        rowData[headers[j]] = tableRow.cells[j].innerHTML.replace(/(<([^>]+)>)/gi, '');
      }

      data.push(rowData);
    }

    return data;
  }

  res.status(StatusCodes.OK).json({
    msg: 'ok',
    data: tableToJson(table),
  });
}
