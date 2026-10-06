import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

/** Runs a shared zod schema on the request body (D-30). Bad data → 400 with one error key per field (D-44). */
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      // e.g. { email: 'emailInvalid', password: 'passwordTooShort' }
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path.map(String).join('.') || 'body';
        errors[field] ??= issue.message; // keep the first error of each field
      }
      throw new BadRequestException({ message: 'validationFailed', errors });
    }

    return result.data; // the cleaned data: trimmed, lowercased, language set
  }
}
