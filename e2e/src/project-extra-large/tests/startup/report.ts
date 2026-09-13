export function reportErrorCode(attempt: () => void): void {
  try {
    attempt();
    console.log(JSON.stringify({ code: 'NO_ERROR' }));
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? String(error.code) : 'UNKNOWN';
    console.log(JSON.stringify({ code }));
  }
}

interface ValidationOutcome {
  readonly errors: readonly { readonly code: string }[];
}

export function reportValidationCode(outcome: ValidationOutcome): void {
  const [firstError] = outcome.errors;
  console.log(JSON.stringify({ code: firstError === undefined ? 'NO_ERROR' : firstError.code }));
}
