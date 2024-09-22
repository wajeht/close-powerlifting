import { describe, expect, test } from 'vitest';

import { DEFAULT_API_CALL_LIMIT } from './enums';

describe('DEFAULT_API_CALL_LIMIT', () => {
  test('has correct value', () => {
    expect(DEFAULT_API_CALL_LIMIT).toBe(500);
  });
});
