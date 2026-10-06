import express, { type NextFunction, type Request, type Response } from 'express';
import { AppError, ValidationError } from '../lib/errors.js';

const rawImageParser = express.raw({
  type: 'application/octet-stream',
  limit: 2 * 1024 * 1024,
  inflate: false,
});

export function adminRawImageUpload(req: Request, res: Response, next: NextFunction): void {
  if (!req.is('application/octet-stream')) {
    next(new AppError(415, '지원하지 않는 업로드 형식입니다', 'UNSUPPORTED_MEDIA_TYPE'));
    return;
  }

  rawImageParser(req, res, (error: unknown) => {
    if (!error) {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        next(new ValidationError('이미지를 선택하세요'));
        return;
      }
      next();
      return;
    }

    if (error instanceof Error && 'type' in error && error.type === 'entity.too.large') {
      next(new AppError(413, '이미지는 2MiB 이하만 업로드할 수 있습니다', 'PAYLOAD_TOO_LARGE'));
      return;
    }
    if (error instanceof Error && 'type' in error && error.type === 'encoding.unsupported') {
      next(new AppError(415, '지원하지 않는 업로드 인코딩입니다', 'UNSUPPORTED_MEDIA_TYPE'));
      return;
    }
    if (error instanceof Error && 'type' in error && error.type === 'request.size.invalid') {
      next(new ValidationError('잘못된 이미지 본문 길이입니다'));
      return;
    }
    next(error);
  });
}
