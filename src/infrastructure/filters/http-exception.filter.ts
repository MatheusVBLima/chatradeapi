import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global HTTP Exception Filter
 * Catches all HTTP exceptions and formats them consistently
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const errorResponse = {
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: this.extractMessage(exceptionResponse),
      error: this.extractError(exceptionResponse),
    };

    // Log the error
    this.logger.error(
      `HTTP ${status} Error: ${request.method} ${request.url}`,
      JSON.stringify(errorResponse),
    );

    response.status(status).json(errorResponse);
  }

  private extractMessage(exceptionResponse: string | object): string | string[] {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const response = exceptionResponse as any;
      return response.message || response.error || 'An error occurred';
    }

    return 'An error occurred';
  }

  private extractError(exceptionResponse: string | object): string {
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const response = exceptionResponse as any;
      return response.error || 'Bad Request';
    }

    return 'Bad Request';
  }
}
