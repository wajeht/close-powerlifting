import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { StatusCodes } from 'http-status-codes';

describe('/api/meets',  () => {
  it('should returns unauthorize errors when requesting without logging in first', async () => {
    const res = await request(app).get('/api/meets');
    expect(res.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
  });

  it('should returns validation errors when logging in with wrong credentials', async () => {
    const res = await request(app).get('/api/meets');
    expect(res.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
  });
});
