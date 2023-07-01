import { JSDOM } from 'jsdom';
import { beforeEach, describe, expect, test } from 'vitest';

import { buildPagination, stripHTML, tableToJson } from './helpers';

describe('tableToJson', () => {
  let table: any;

  beforeEach(() => {
    const dom = new JSDOM(`
      <table>
        <tr>
          <th>Header 1</th>
          <th>Header 2</th>
        </tr>
        <tr>
          <td>Data 1-1</td>
          <td>Data 1-2</td>
        </tr>
        <tr>
          <td>Data 2-1</td>
          <td>Data 2-2</td>
        </tr>
      </table>
    `);

    table = dom.window.document.querySelector('table');
  });

  test('converts table to JSON', () => {
    const expectedData = [
      { header1: 'Data 1-1', header2: 'Data 1-2' },
      { header1: 'Data 2-1', header2: 'Data 2-2' },
    ];

    expect(tableToJson(table)).toEqual(expectedData);
  });
});

describe('buildPagination', () => {
  test('returns the correct pagination string', () => {
    const pagination = buildPagination({ current_page: 2, per_page: 10 });
    expect(pagination).toEqual('start=20&end=30&lang=en&units=lbs');
  });

  test('handles the first page correctly', () => {
    const pagination = buildPagination({ current_page: 1, per_page: 10 });
    expect(pagination).toEqual('start=0&end=10&lang=en&units=lbs');
  });
});

describe('stripHTML', () => {
  test('removes HTML tags from the input string', () => {
    const input = '<p>This is <strong>bold</strong> text.</p>';
    const result = stripHTML(input);
    expect(result).toEqual('This is bold text.');
  });

  test('handles empty string correctly', () => {
    const input = '';
    const result = stripHTML(input);
    expect(result).toEqual('');
  });

  test('handles input with no HTML tags correctly', () => {
    const input = 'This is plain text.';
    const result = stripHTML(input);
    expect(result).toEqual('This is plain text.');
  });
});
