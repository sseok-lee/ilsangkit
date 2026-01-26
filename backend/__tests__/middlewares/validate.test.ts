// @TASK T0.5.2 - 유효성 검사 미들웨어 테스트
// @TEST backend/__tests__/middlewares/validate.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate, validateMultiple } from '../../src/middlewares/validate';

// Mock Request, Response, NextFunction
function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    query: {},
    params: {},
    ...overrides,
  } as Request;
}

function createMockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('validate middleware', () => {
  const testSchema = z.object({
    name: z.string().min(1),
    age: z.coerce.number().int().min(0),
  });

  let mockNext: NextFunction;

  beforeEach(() => {
    mockNext = vi.fn();
  });

  it('유효한 body 데이터를 파싱해야 한다', () => {
    const req = createMockReq({ body: { name: 'John', age: 25 } });
    const res = createMockRes();

    validate(testSchema, 'body')(req, res, mockNext);

    expect(req.body).toEqual({ name: 'John', age: 25 });
    expect(mockNext).toHaveBeenCalled();
  });

  it('유효한 query 데이터를 파싱해야 한다', () => {
    const req = createMockReq({ query: { name: 'Jane', age: '30' } });
    const res = createMockRes();

    validate(testSchema, 'query')(req, res, mockNext);

    expect(req.query).toEqual({ name: 'Jane', age: 30 });
    expect(mockNext).toHaveBeenCalled();
  });

  it('유효하지 않은 데이터면 422를 반환해야 한다', () => {
    const req = createMockReq({ body: { name: '', age: -1 } });
    const res = createMockRes();

    validate(testSchema, 'body')(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: '입력값이 올바르지 않습니다',
        }),
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('기본 source는 body여야 한다', () => {
    const req = createMockReq({ body: { name: 'Test', age: 20 } });
    const res = createMockRes();

    validate(testSchema)(req, res, mockNext);

    expect(req.body).toEqual({ name: 'Test', age: 20 });
    expect(mockNext).toHaveBeenCalled();
  });
});

describe('validateMultiple middleware', () => {
  const paramsSchema = z.object({
    id: z.string().min(1),
  });

  const querySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
  });

  let mockNext: NextFunction;

  beforeEach(() => {
    mockNext = vi.fn();
  });

  it('여러 소스를 동시에 검증해야 한다', () => {
    const req = createMockReq({
      params: { id: 'abc123' },
      query: { page: '2' },
    });
    const res = createMockRes();

    validateMultiple({
      params: paramsSchema,
      query: querySchema,
    })(req, res, mockNext);

    expect(req.params).toEqual({ id: 'abc123' });
    expect(req.query).toEqual({ page: 2 });
    expect(mockNext).toHaveBeenCalled();
  });

  it('하나라도 실패하면 422를 반환해야 한다', () => {
    const req = createMockReq({
      params: { id: '' },
      query: { page: '1' },
    });
    const res = createMockRes();

    validateMultiple({
      params: paramsSchema,
      query: querySchema,
    })(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('여러 소스가 모두 실패하면 모든 에러를 포함해야 한다', () => {
    const req = createMockReq({
      params: { id: '' },
      query: { page: '0' },
    });
    const res = createMockRes();

    validateMultiple({
      params: paramsSchema,
      query: querySchema,
    })(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          details: expect.objectContaining({
            params: expect.anything(),
            query: expect.anything(),
          }),
        }),
      })
    );
  });
});
