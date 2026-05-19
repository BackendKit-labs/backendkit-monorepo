import { ConflictException, HttpException, HttpStatus } from '@nestjs/common';

export class IdempotencyPendingConflictError extends ConflictException {
  constructor(key: string) {
    super({
      statusCode: HttpStatus.CONFLICT,
      error:      'Conflict',
      message:    `Request with idempotency key "${key}" is still in progress`,
    });
  }
}

export class IdempotencyKeyMissingError extends HttpException {
  constructor(header: string) {
    super(
      {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        error:      'Unprocessable Entity',
        message:    `Missing required header: ${header}`,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class IdempotencyKeyInvalidError extends HttpException {
  constructor(header: string) {
    super(
      {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        error:      'Unprocessable Entity',
        message:    `Header "${header}" must be 1–256 printable ASCII characters`,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
