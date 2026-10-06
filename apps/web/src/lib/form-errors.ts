/** zod issues → { email: 'emailInvalid', … }: the first error of each field, like the API's pipe (D-44) */
export function errorsByField(
  issues: { path: PropertyKey[]; message: string }[],
) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const field = issue.path.map(String).join('.') || 'form';
    errors[field] ??= issue.message;
  }
  return errors;
}
