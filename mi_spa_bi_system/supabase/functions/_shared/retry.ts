// ============================================================================
// MI SPA BI SYSTEM - Retry Logic
// FALLA #6: Rate limit Bsale API - Backoff exponencial + jitter
// ============================================================================

export const RATE_LIMIT_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.2,
  requestDelayMs: 300,
  batchDelayMs: 500,
};

const RETRYABLE_STATUS = [429, 500, 502, 503, 504];

export function isRetryableError(error: Error | Response): boolean {
  if (error instanceof Response) return RETRYABLE_STATUS.includes(error.status);
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return ['rate limit', 'timeout', 'network', 'econnreset'].some(k => msg.includes(k));
  }
  return false;
}

export function calculateDelay(attempt: number): number {
  const base = RATE_LIMIT_CONFIG.initialDelayMs * Math.pow(RATE_LIMIT_CONFIG.backoffMultiplier, attempt);
  const capped = Math.min(base, RATE_LIMIT_CONFIG.maxDelayMs);
  const jitter = capped * RATE_LIMIT_CONFIG.jitterFactor * (Math.random() * 2 - 1);
  return Math.floor(capped + jitter);
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: { maxRetries?: number; operationName?: string } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? RATE_LIMIT_CONFIG.maxRetries;
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries && isRetryableError(error as Error | Response)) {
        const delay = calculateDelay(attempt);
        console.warn(`🔄 Retry ${attempt + 1}/${maxRetries} in ${delay}ms: ${lastError.message}`);
        await sleep(delay);
      } else {
        throw lastError;
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

export async function fetchWithRetry(url: string, options: RequestInit = {}): Promise<Response> {
  return withRetry(async () => {
    const response = await fetch(url, options);
    if (!response.ok && isRetryableError(response)) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response;
  }, { operationName: `fetch ${url.split('?')[0]}` });
}

export class RateLimiter {
  private lastRequest = 0;
  constructor(private minIntervalMs = RATE_LIMIT_CONFIG.requestDelayMs) {}
  
  async wait(): Promise<void> {
    const elapsed = Date.now() - this.lastRequest;
    if (elapsed < this.minIntervalMs) {
      await sleep(this.minIntervalMs - elapsed);
    }
    this.lastRequest = Date.now();
  }
}

export const rateLimiter = new RateLimiter();
