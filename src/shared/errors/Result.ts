import { AppError } from './AppError';

export type Result<T, E = AppError> =
  | { readonly success: true; readonly value: T; readonly error?: never }
  | { readonly success: false; readonly error: E; readonly value?: never };

export const Result = {
  ok<T>(value: T): Result<T, never> {
    return { success: true, value };
  },

  fail<E = AppError>(error: E): Result<never, E> {
    return { success: false, error };
  },

  isOk<T, E>(result: Result<T, E>): result is { readonly success: true; readonly value: T } {
    return result.success;
  },

  isFailure<T, E>(result: Result<T, E>): result is { readonly success: false; readonly error: E } {
    return !result.success;
  },
};
