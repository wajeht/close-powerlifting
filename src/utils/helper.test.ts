import { JSDOM } from 'jsdom';
import { beforeEach, describe, expect, test } from 'vitest';

import { buildPagination, generateAPIKey, hashKey, stripHTML, tableToJson } from './helpers';

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

  test('handles empty table correctly', () => {
    const dom = new JSDOM(`
      <table>
        <tr>
          <th>Header 1</th>
          <th>Header 2</th>
        </tr>
      </table>
    `);

    const table = dom.window.document.querySelector('table');
    expect(tableToJson(table)).toEqual([]);
  });

  test('handles table with only headers correctly', () => {
    const dom = new JSDOM(`
      <table>
        <tr>
          <th>Header 1</th>
          <th>Header 2</th>
        </tr>
      </table>
    `);

    const table = dom.window.document.querySelector('table');
    expect(tableToJson(table)).toEqual([]);
  });

  test('handles table with only one row correctly', () => {
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
      </table>
    `);

    const table = dom.window.document.querySelector('table');
    expect(tableToJson(table)).toEqual([{ header1: 'Data 1-1', header2: 'Data 1-2' }]);
  });

  test('handles table with only one column correctly', () => {
    const dom = new JSDOM(`
      <table>
        <tr>
          <th>Header 1</th>
        </tr>
        <tr>
          <td>Data 1-1</td>
        </tr>
        <tr>
          <td>Data 2-1</td>
        </tr>
      </table>
    `);

    const table = dom.window.document.querySelector('table');
    expect(tableToJson(table)).toEqual([{ header1: 'Data 1-1' }, { header1: 'Data 2-1' }]);
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

  test('handles the last page correctly', () => {
    const pagination = buildPagination({ current_page: 5, per_page: 10 });
    expect(pagination).toEqual('start=50&end=60&lang=en&units=lbs');
  });

  test('handles the first page with a different number of items per page correctly', () => {
    const pagination = buildPagination({ current_page: 1, per_page: 5 });
    expect(pagination).toEqual('start=0&end=5&lang=en&units=lbs');
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

  test('handles input with only HTML tags correctly', () => {
    const input = '<p></p>';
    const result = stripHTML(input);
    expect(result).toEqual('');
  });
});

describe('hashKey', () => {
  test('returns a hashed key', async () => {
    const { key, hashedKey } = await hashKey();
    expect(key).toBeDefined();
    expect(hashedKey).toBeDefined();
  });

  test('returns a different key and hashed key each time', async () => {
    const { key: key1, hashedKey: hashedKey1 } = await hashKey();
    const { key: key2, hashedKey: hashedKey2 } = await hashKey();
    expect(key1).not.toEqual(key2);
    expect(hashedKey1).not.toEqual(hashedKey2);
  });
});

describe('generateAPIKey', () => {
  test('returns a hashed key', async () => {
    const { unhashedKey, hashedKey } = await generateAPIKey({
      userId: '1',
      email: 'test@test.com',
      name: 'Test User',
    });
    expect(unhashedKey).toBeDefined();
    expect(hashedKey).toBeDefined();
  });

  test('returns a different key and hashed key each time', async () => {
    const { unhashedKey: key1, hashedKey: hashedKey1 } = await generateAPIKey({
      userId: '1',
      email: '1test@test.com',
      name: '1Test User',
    });
    const { unhashedKey: key2, hashedKey: hashedKey2 } = await generateAPIKey({
      userId: '2',
      email: '2test@test.com',
      name: '2Test User',
    });
    expect(key1).not.toEqual(key2);
    expect(hashedKey1).not.toEqual(hashedKey2);
  });

  describe('when admin flag is passed', () => {
    test('returns a hashed key', async () => {
      const { unhashedKey, hashedKey } = await generateAPIKey({
        userId: '1',
        email: '',
        name: '',
        admin: true,
      });
      expect(unhashedKey).toBeDefined();
      expect(hashedKey).toBeDefined();
    });
  });
});
