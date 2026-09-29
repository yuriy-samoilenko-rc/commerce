import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  NotFoundException,
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
  | 'COUNT_ALREADY_OPEN'
  | 'COUNT_WRONG_STATE'
  | 'UNKNOWN_CODE'
  | 'SCAN_SERIAL_NOT_BARCODE'
  | 'SERIAL_IS_ONE_UNIT'
  | 'SERIAL_OTHER_PRODUCT'
  | 'SERIAL_ALREADY_COUNTED'
  | 'SERIAL_ELSEWHERE'
  | 'OUT_OF_COUNT_SCOPE'
  | 'ORDER_NOT_RETURNABLE'
  | 'RETURN_WRONG_STATE'
  | 'RETURN_QTY_EXCEEDED'
  | 'RETURN_PERIOD_PASSED'
  | 'RETURN_UNDECIDED'
  | 'RETURN_UNITS_CHANGED'
  | 'SERIAL_NOT_FOUND'
  | 'WARRANTY_UNIT_NOT_SOLD'
  | 'NO_WARRANTY'
  | 'WARRANTY_EXPIRED'
  | 'WARRANTY_ALREADY_OPEN'
  | 'WARRANTY_WRONG_STATE'
  | 'UNIT_STATE_CHANGED'
  | 'REPLACEMENT_UNAVAILABLE'
  | 'NOT_IN_PICK_LIST'
  | 'PICK_LIMIT'
  | 'UNPICK_LIMIT'
  | 'PICKING_INCOMPLETE'
  | 'SERIAL_ALREADY_PICKED'
  | 'SERIAL_PICKED_ELSEWHERE'
  | 'SERIAL_NOT_PICKED'
  | 'NO_FILES'
  | 'TOO_MANY_IMAGES'
  | 'IMAGE_FORMAT'
  | 'IMAGE_ORDER'
  | 'NOT_A_PICKUP_POINT'
  | 'SALE_END_WITHOUT_DISCOUNT'
  | 'SALE_END_PAST'
  | 'REVIEW_NOT_ALLOWED'
  | 'REVIEW_EXISTS'
  | 'WRONG_PASSWORD'
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

export const notFound = (
  code: ErrorCode,
  message: string,
  params?: ErrorParams,
): NotFoundException =>
  coded(HttpStatus.NOT_FOUND, 'Not Found', code, message, params);
