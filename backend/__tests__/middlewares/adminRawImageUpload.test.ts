import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { adminRawImageUpload } from '../../src/middlewares/adminRawImageUpload.js';

function makeRawRequest(body: Buffer, contentLength: number): Request {
  const req = new PassThrough() as PassThrough & Partial<Request>;
  req.headers = {
    'content-type': 'application/octet-stream',
    'content-length': String(contentLength),
  };
  req.method = 'POST';
  req.url = '/api/admin/affiliate-banner-images';
  req.is = (type: string) => type === 'application/octet-stream';
  req.end(body);
  return req as Request;
}

describe('adminRawImageUpload', () => {
  it('maps request.size.invalid parser errors to 422 validation errors', async () => {
    const req = makeRawRequest(Buffer.from('x'), 5);
    const res = {} as Response;
    const next = vi.fn();

    adminRawImageUpload(req, res, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalled());

    expect(next.mock.calls[0][0]).toMatchObject({
      statusCode: 422,
      code: 'VALIDATION_ERROR',
    });
  });
});
