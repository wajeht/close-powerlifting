import { StatusCodes } from 'http-status-codes';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../app';

describe('/api/meets', () => {
  it('should returns unauthorize errors when requesting without logging in first', async () => {
    const res = await request(app).get('/api/meets');
    expect(res.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
  });

  it('should returns validation errors when logging in with wrong credentials', async () => {
    const res = await request(app).get('/api/meets');
    expect(res.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
  });
});
