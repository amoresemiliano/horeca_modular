import { createHash } from 'node:crypto';

export interface RateContext { LocationID?: string; OrganizationID?: string }
export interface RateReservation { allowed: boolean; retry_after_ms: number }
export interface RateBudgetStore {
  reserve(tokenHash: string, kind: 'location' | 'organization' | 'organizations', entity: string, signal?: AbortSignal): Promise<RateReservation>;
}
export class RateBudgetError extends Error {
  constructor(code: string) { super(code); }
}
export interface RatePermit { assertFresh(): void }

async function bounded<T>(operation: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const stop = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new RateBudgetError('SOURCE_RATE_DEADLINE')), ms);
    onAbort = () => reject(new RateBudgetError('SOURCE_CANCELLED'));
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
  try { return await Promise.race([operation, stop]); }
  finally { clearTimeout(timer); if (onAbort) signal?.removeEventListener('abort', onAbort); }
}

/** Server only. The store must serialize reservations across ALL runtime instances. */
export class LastAppRateLimiter {
  constructor(private readonly store: RateBudgetStore,
    private readonly now: () => number = () => performance.now(),
    private readonly sleep: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))) {}

  async acquire(token: string, context: RateContext | undefined, deadline: number, signal?: AbortSignal): Promise<RatePermit> {
    if (!Number.isFinite(deadline)) throw new RateBudgetError('SOURCE_RATE_DEADLINE');
    const kind = context?.LocationID ? 'location' : context?.OrganizationID ? 'organization' : 'organizations';
    const entity = context?.LocationID ?? context?.OrganizationID ?? '*';
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const check = () => {
      if (signal?.aborted) throw new RateBudgetError('SOURCE_CANCELLED');
      if (this.now() >= deadline) throw new RateBudgetError('SOURCE_RATE_DEADLINE');
    };
    // Bounded admission attempts; no local queue or indefinitely polling waiters.
    for (let claim = 0; claim < 8; claim++) {
      check();
      const started = this.now();
      let reservation: RateReservation;
      const controller = new AbortController();
      const reserveSignal = signal ? AbortSignal.any([controller.signal, signal]) : controller.signal;
      try { reservation = await bounded(this.store.reserve(tokenHash, kind, entity, reserveSignal), Math.min(1000, deadline-started), signal); }
      catch (error) {
        if (error instanceof RateBudgetError) throw error;
        throw new RateBudgetError('SOURCE_RATE_COORDINATOR_UNAVAILABLE');
      } finally { controller.abort(); }
      check();
      if (typeof reservation?.allowed !== 'boolean' || !Number.isFinite(reservation.retry_after_ms) || reservation.retry_after_ms < 0) {
        throw new RateBudgetError('SOURCE_RATE_COORDINATOR_UNAVAILABLE');
      }
      if (reservation.allowed) {
        const expires = Math.min(started + 1000, deadline);
        const permit = { assertFresh: () => {
          check();
          if (this.now() >= expires) throw new RateBudgetError('SOURCE_RATE_PERMIT_EXPIRED');
        } };
        permit.assertFresh();
        return permit;
      }
      const delay = Math.max(1, Math.ceil(reservation.retry_after_ms));
      if (this.now() + delay >= deadline) throw new RateBudgetError('SOURCE_RATE_DEADLINE');
      await bounded(this.sleep(delay), deadline-this.now(), signal);
    }
    throw new RateBudgetError('SOURCE_RATE_CONTENTION');
  }
}
