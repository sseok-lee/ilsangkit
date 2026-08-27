export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string, code: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, message, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  public readonly details?: unknown;

  constructor(message = 'Validation failed', details?: unknown) {
    super(422, message, 'VALIDATION_ERROR');
    this.details = details;
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(409, message, 'CONFLICT');
  }
}

/**
 * 410 Gone — 영구히 제거된 리소스.
 *
 * NotFoundError(404)와 구분한다. 404 는 "지금 못 찾겠다"라서 크롤러가 한동안 재시도하고,
 * 410 은 "영구히 없어졌다"라서 색인에서 더 빨리 빠진다. 원천 데이터에서 사라진 시설
 * (폐업·전환)의 상세 URL 에 쓴다 — FacilityGone 테이블 참고.
 */
export class GoneError extends AppError {
  constructor(message = 'Resource permanently removed') {
    super(410, message, 'GONE');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, message, 'FORBIDDEN');
  }
}
