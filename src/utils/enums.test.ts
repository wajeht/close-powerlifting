import { describe, expect, test } from 'vitest';

import { DEFAULT_API_CALL_LIMIT, ENV_ENUMS } from './enums';

describe('ENV_ENUMS', () => {
  test('has correct values', () => {
    expect(ENV_ENUMS).toEqual({
      PRODUCTION: 'production',
      DEVELOPMENT: 'development',
      TESTING: 'testing',
      LOCAL: 'local',
    });
  });
});

describe('DEFAULT_API_CALL_LIMIT', () => {
  test('has correct value', () => {
    expect(DEFAULT_API_CALL_LIMIT).toBe(500);
  });
});
