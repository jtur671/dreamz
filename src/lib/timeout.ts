export class TimeoutError extends Error {
  readonly label: string;
  readonly ms: number;

  constructor(label: string, ms: number) {
    super(`Timed out after ${ms}ms: ${label}`);
    this.name = 'TimeoutError';
    this.label = label;
    this.ms = ms;
  }
}

// Accepts PromiseLike so it works with Supabase's postgrest query builders
// (which are thenables, not proper Promises).
export function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(label, ms));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
