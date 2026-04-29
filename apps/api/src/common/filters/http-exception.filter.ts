import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorResponseBody {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string | string[];
  error: string;
  requestId?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = exception instanceof HttpException
      ? exception.getResponse()
      : null;

    const body = this.normalizeResponse(exceptionResponse, status, request);

    const logPayload = {
      requestId: body.requestId,
      method: body.method,
      path: body.path,
      statusCode: body.statusCode,
      message: body.message,
    };

    if (status >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(JSON.stringify(logPayload), stack);
    } else {
      this.logger.warn(JSON.stringify(logPayload));
    }

    response.status(status).json(body);
  }

  private normalizeResponse(
    exceptionResponse: string | object | null,
    status: number,
    request: Request & { id?: string },
  ): ErrorResponseBody {
    const fallbackError = status >= 500 ? 'Internal Server Error' : 'Bad Request';
    const body: ErrorResponseBody = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.originalUrl || request.url,
      method: request.method,
      message: fallbackError,
      error: fallbackError,
      requestId: request.id,
    };

    if (typeof exceptionResponse === 'string') {
      body.message = exceptionResponse;
      body.error = fallbackError;
      return body;
    }

    if (exceptionResponse && typeof exceptionResponse === 'object') {
      const responseBody = exceptionResponse as Record<string, unknown>;
      const message = responseBody.message;
      body.message = Array.isArray(message) || typeof message === 'string'
        ? message
        : fallbackError;
      body.error = typeof responseBody.error === 'string'
        ? responseBody.error
        : fallbackError;
    }

    return body;
  }
}
