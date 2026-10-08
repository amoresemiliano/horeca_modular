import type { SupabaseClient } from '@supabase/supabase-js';
import type { RateBudgetStore, RateReservation } from './LastAppRateLimiter.js';

/** No local fallback: missing migration, transport or invalid response denies dispatch. */
export class SupabaseLastAppRateBudget implements RateBudgetStore {
  constructor(private readonly client: SupabaseClient) {}
  async reserve(tokenHash: string, kind: 'location' | 'organization' | 'organizations', entity: string, signal?: AbortSignal): Promise<RateReservation> {
    let request = this.client.rpc('sales_reserve_lastapp_request', {
      p_token_hash: tokenHash, p_kind: kind, p_entity: entity,
    });
    if (signal) request = request.abortSignal(signal);
    const { data, error } = await request;
    if (error || !data) throw new Error('RATE_COORDINATOR_UNAVAILABLE');
    return data as RateReservation;
  }
}
