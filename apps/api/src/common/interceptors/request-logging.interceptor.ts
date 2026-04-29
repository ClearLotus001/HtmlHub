import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Observable, tap } from 'rxjs';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { id?: string }>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();
    const requestId = request.headers['x-request-id'];

    request.id = typeof requestId === 'string' && requestId.trim()
      ? requestId.trim()
      : randomUUID();
    response.setHeader('x-request-id', request.id);

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(JSON.stringify({
            requestId: request.id,
            method: request.method,
            path: request.originalUrl || request.url,
            statusCode: response.statusCode,
            durationMs: Date.now() - startedAt,
          }));
        },
        error: (error: unknown) => {
          const statusCode = typeof (error as { status?: unknown }).status === 'number'
            ? (error as { status: number }).status
            : response.statusCode;
          this.logger.warn(JSON.stringify({
            requestId: request.id,
            method: request.method,
            path: request.originalUrl || request.url,
            statusCode,
            durationMs: Date.now() - startedAt,
          }));
        },
      }),
    );
  }
}
