// One error shape for every response (D-44, api-conventions.md §6): { message, errors? }.
// "message" is always a key the web app translates (e.g. "notFound"), never an English sentence.
// Runs last: whatever went wrong in a guard, pipe, controller or service ends up here.
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';

/** The body every error response has */
export interface ApiErrorBody {
  message: string;
  errors?: Record<string, string>;
}

/** Message key for a status code when the error did not bring its own key */
const KEY_BY_STATUS: Record<number, string> = {
  400: 'badRequest',
  401: 'notLoggedIn',
  403: 'forbidden',
  404: 'notFound',
  409: 'conflict',
  413: 'payloadTooLarge',
  429: 'tooManyRequests',
};

/** Database errors that are the caller's fault, not a server crash */
const PRISMA_ERRORS: Record<string, { status: number; message: string }> = {
  P2002: { status: HttpStatus.CONFLICT, message: 'conflict' }, // a unique value is already used
  P2003: { status: HttpStatus.BAD_REQUEST, message: 'invalidReference' }, // points at a row that is not in this company (D-48)
  P2025: { status: HttpStatus.NOT_FOUND, message: 'notFound' }, // the row to change does not exist (or is another company's)
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiError');

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const { status, body } = this.toResponse(exception);

    // Our own bugs are logged with enough context to find them; never personal data
    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.originalUrl} → ${status} (company ${req.auth?.companyId ?? '-'})`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(status).json(body);
  }

  private toResponse(exception: unknown): {
    status: number;
    body: ApiErrorBody;
  } {
    // 1. Errors we threw on purpose, or Nest's own (404 route, 400 bad JSON…)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      // Ours look like { message: 'invalidCredentials', errors?: {...} } with no statusCode
      if (
        typeof raw === 'object' &&
        raw !== null &&
        typeof (raw as { message?: unknown }).message === 'string' &&
        !('statusCode' in raw)
      ) {
        const { message, errors } = raw as ApiErrorBody;
        return { status, body: errors ? { message, errors } : { message } };
      }
      // Nest's built-in errors carry English sentences: replace them with a key
      return {
        status,
        body: {
          message:
            KEY_BY_STATUS[status] ??
            (status >= 500 ? 'internalError' : 'badRequest'),
        },
      };
    }

    // 2. Known database errors caused by the request
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const known = PRISMA_ERRORS[exception.code];
      if (known) {
        return { status: known.status, body: { message: known.message } };
      }
    }

    // 3. Anything else is our bug: say little, log everything (above)
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { message: 'internalError' },
    };
  }
}
