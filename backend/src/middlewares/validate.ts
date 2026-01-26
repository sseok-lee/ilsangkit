// @TASK T0.5.2 - Zod 유효성 검사 미들웨어
// @SPEC docs/planning/02-trd.md#API-설계

import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';

type ValidationSource = 'body' | 'query' | 'params';

/**
 * Zod 스키마를 사용한 유효성 검사 미들웨어
 *
 * @param schema - Zod 스키마
 * @param source - 검증할 요청 데이터 소스 (body, query, params)
 * @returns Express 미들웨어
 *
 * @example
 * router.get('/facilities',
 *   validate(FacilitySearchSchema, 'query'),
 *   facilityController.search
 * );
 */
export function validate<T extends ZodSchema>(
  schema: T,
  source: ValidationSource = 'body'
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = schema.parse(req[source]);
      // 파싱된 데이터로 교체 (타입 변환 및 기본값 적용됨)
      req[source] = data;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(422).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '입력값이 올바르지 않습니다',
            details: error.flatten(),
          },
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * 여러 소스를 동시에 검증하는 미들웨어
 *
 * @param schemas - 소스별 스키마 객체
 * @returns Express 미들웨어
 *
 * @example
 * router.get('/facilities/:category/:id',
 *   validateMultiple({
 *     params: FacilityDetailParamsSchema,
 *     query: PaginationSchema,
 *   }),
 *   facilityController.getDetail
 * );
 */
export function validateMultiple(schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: Record<string, unknown> = {};

    for (const [source, schema] of Object.entries(schemas)) {
      if (schema) {
        try {
          const data = schema.parse(req[source as ValidationSource]);
          req[source as ValidationSource] = data;
        } catch (error) {
          if (error instanceof ZodError) {
            errors[source] = error.flatten();
          } else {
            next(error);
            return;
          }
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      res.status(422).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '입력값이 올바르지 않습니다',
          details: errors,
        },
      });
      return;
    }

    next();
  };
}
