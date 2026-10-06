export const AppErrorCode = {
  AUTHENTICATION: 'AUTHENTICATION',
  AUTHORIZATION: 'AUTHORIZATION',
  VALIDATION: 'VALIDATION',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INFRASTRUCTURE: 'INFRASTRUCTURE',
  UNEXPECTED: 'UNEXPECTED',
} as const;

export type AppErrorCode = (typeof AppErrorCode)[keyof typeof AppErrorCode];

export interface AppErrorDetails {
  readonly field?: string;
  readonly reason?: string;
  readonly metadata?: Record<string, unknown>;
}

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly details?: AppErrorDetails;
  public readonly timestamp: string;

  constructor(code: AppErrorCode, message: string, details?: AppErrorDetails) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
    };
  }

  public static authentication(message = 'Authentication required'): AppError {
    return new AppError(AppErrorCode.AUTHENTICATION, message);
  }

  public static authorization(message = 'Permission denied'): AppError {
    return new AppError(AppErrorCode.AUTHORIZATION, message);
  }

  public static validation(message: string, details?: AppErrorDetails): AppError {
    return new AppError(AppErrorCode.VALIDATION, message, details);
  }

  public static notFound(message = 'Resource not found'): AppError {
    return new AppError(AppErrorCode.NOT_FOUND, message);
  }

  public static conflict(message = 'Resource conflict'): AppError {
    return new AppError(AppErrorCode.CONFLICT, message);
  }

  public static infrastructure(message: string, details?: AppErrorDetails): AppError {
    return new AppError(AppErrorCode.INFRASTRUCTURE, message, details);
  }

  public static unexpected(message = 'An unexpected error occurred'): AppError {
    return new AppError(AppErrorCode.UNEXPECTED, message);
  }
}
