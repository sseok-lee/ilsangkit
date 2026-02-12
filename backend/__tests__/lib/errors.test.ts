import { describe, it, expect } from 'vitest';
import { AppError, NotFoundError, ValidationError, ConflictError } from '../../src/lib/errors.js';

describe('AppError', () => {
  it('sets statusCode, code, message, and isOperational', () => {
    const err = new AppError(400, 'bad request', 'BAD_REQUEST');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.message).toBe('bad request');
    expect(err.isOperational).toBe(true);
    expect(err.name).toBe('AppError');
    expect(err).toBeInstanceOf(Error);
  });

  it('allows isOperational to be set to false', () => {
    const err = new AppError(500, 'fatal', 'FATAL', false);
    expect(err.isOperational).toBe(false);
  });
});

describe('NotFoundError', () => {
  it('defaults to 404 and NOT_FOUND', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Resource not found');
    expect(err.isOperational).toBe(true);
    expect(err.name).toBe('NotFoundError');
  });

  it('accepts a custom message', () => {
    const err = new NotFoundError('User not found');
    expect(err.message).toBe('User not found');
    expect(err.statusCode).toBe(404);
  });
});

describe('ValidationError', () => {
  it('defaults to 422 and VALIDATION_ERROR', () => {
    const err = new ValidationError();
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Validation failed');
  });

  it('accepts details', () => {
    const details = { field: 'email', reason: 'invalid format' };
    const err = new ValidationError('Invalid input', details);
    expect(err.details).toEqual(details);
    expect(err.message).toBe('Invalid input');
  });
});

describe('ConflictError', () => {
  it('defaults to 409 and CONFLICT', () => {
    const err = new ConflictError();
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
    expect(err.message).toBe('Resource conflict');
  });

  it('accepts a custom message', () => {
    const err = new ConflictError('Duplicate entry');
    expect(err.message).toBe('Duplicate entry');
  });
});
