import { describe, it, expect } from 'vitest';
import { AppError, AppErrorCode } from '../../src/shared/errors/AppError';
import { Result } from '../../src/shared/errors/Result';

describe('Error & Result Model (Scope D)', () => {
  it('instantiates specific error codes with safe JSON serialization', () => {
    const err = AppError.authorization('Tenant isolation access denied');
    expect(err.code).toBe(AppErrorCode.AUTHORIZATION);
    expect(err.message).toBe('Tenant isolation access denied');

    const json = err.toJSON();
    expect(json.code).toBe('AUTHORIZATION');
    expect(json.timestamp).toBeDefined();
  });

  it('distinguishes all core error categories', () => {
    expect(AppError.authentication().code).toBe(AppErrorCode.AUTHENTICATION);
    expect(AppError.authorization().code).toBe(AppErrorCode.AUTHORIZATION);
    expect(AppError.validation('Invalid data').code).toBe(AppErrorCode.VALIDATION);
    expect(AppError.notFound().code).toBe(AppErrorCode.NOT_FOUND);
    expect(AppError.conflict().code).toBe(AppErrorCode.CONFLICT);
    expect(AppError.infrastructure('DB timeout').code).toBe(AppErrorCode.INFRASTRUCTURE);
    expect(AppError.unexpected().code).toBe(AppErrorCode.UNEXPECTED);
  });

  it('handles Result.ok and Result.fail containers functionally', () => {
    const successResult = Result.ok({ id: 'org-123' });
    expect(Result.isOk(successResult)).toBe(true);
    expect(Result.isFailure(successResult)).toBe(false);
    if (Result.isOk(successResult)) {
      expect(successResult.value.id).toBe('org-123');
    }

    const failureResult = Result.fail(AppError.notFound('Org missing'));
    expect(Result.isOk(failureResult)).toBe(false);
    expect(Result.isFailure(failureResult)).toBe(true);
    if (Result.isFailure(failureResult)) {
      expect(failureResult.error.code).toBe(AppErrorCode.NOT_FOUND);
    }
  });
});
