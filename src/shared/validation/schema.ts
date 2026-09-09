import { z, ZodSchema } from 'zod';
import { Result } from '../errors/Result';
import { AppError } from '../errors/AppError';

export function validateSchema<T>(schema: ZodSchema<T>, data: unknown): Result<T, AppError> {
  const parseResult = schema.safeParse(data);
  if (!parseResult.success) {
    const issue = parseResult.error.issues[0];
    const field = issue ? issue.path.join('.') : undefined;
    const message = issue ? issue.message : 'Validation failed';
    return Result.fail(
      AppError.validation(`Validation error on field '${field || 'root'}': ${message}`, {
        field,
        reason: message,
      })
    );
  }

  return Result.ok(parseResult.data);
}

export { z };
