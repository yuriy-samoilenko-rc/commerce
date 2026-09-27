import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

/**
 * Machine-readable reasons the UI translates for people (the UI speaks Montenegrin,
 * `message` stays English for logs and API docs). Add a code when a screen needs to
 * explain a refusal better than "this is not possible right now".
 */
export type ErrorCode =
  | 'INSUFFICIENT_STOCK'
  | 'PRODUCT_UNAVAILABLE'
  | 'ORDER_WRONG_STATE'
  | 'ORDER_NOT_PAID'
  | 'DUPLICATE'
  | 'SERIAL_MODE_LOCKED'
  | 'DISCOUNT_NOT_LOWER'
  | 'PRODUCT_ARCHIVED'
  | 'WAREHOUSE_INACTIVE'
  | 'SERIALS_NOT_TRACKED'
  | 'SERIALS_COUNT_MISMATCH'
  | 'SERIALS_DUPLICATE'
  | 'SERIALS_TAKEN'
  | 'SERIALS_UNAVAILABLE'
  | 'STOCK_BEING_COUNTED'
  | 'NOT_DRAFT'
  | 'TRANSFER_WRONG_STATE'
  | 'SAME_WAREHOUSE'
  | 'DOCUMENT_EMPTY';

export type ErrorParams = Record<string, string | number>;

/** Same body shape as Nest's built-in errors, plus `code` and `params`. */
function coded(
  status: HttpStatus,
  error: string,
  code: ErrorCode,
  message: string,
  params?: ErrorParams,
) {
  return new HttpException(
    { statusCode: status, error, code, message, ...(params && { params }) },
    status,
  );
}

export const conflict = (
  code: ErrorCode,
  message: string,
  params?: ErrorParams,
): ConflictException =>
  coded(HttpStatus.CONFLICT, 'Conflict', code, message, params);

export const badRequest = (
  code: ErrorCode,
  message: string,
  params?: ErrorParams,
): BadRequestException =>
  coded(HttpStatus.BAD_REQUEST, 'Bad Request', code, message, params);
