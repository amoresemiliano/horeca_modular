import type { SalesSourcePort, SourceTab, SourceBill, SourcePayment, SourceWindow, SourcePage } from '../../../application/sales/ports/SalesSourcePort.js';

export class SalesSourceError extends Error {
  constructor(public readonly code: string, public readonly status?: number) { super(code); }
}
export interface LastAppOptions {
  token: string; fetch?: typeof fetch; sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number; maxAttempts?: number; maxPages?: number;
}
/** Server composition only. Never import this adapter from a client module. */
export class LastAppAdapter implements SalesSourcePort {
  private readonly options: Required<LastAppOptions>;
  constructor(options: LastAppOptions) {
    if (!options.token?.trim()) throw new SalesSourceError('LAST_APP_NOT_CONFIGURED');
    this.options = { fetch: globalThis.fetch, sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
      timeoutMs: 10000, maxAttempts: 3, maxPages: 100, ...options };
    if (this.options.maxAttempts < 1 || this.options.maxAttempts > 5 || this.options.timeoutMs <= 0) {
      throw new SalesSourceError('INVALID_TRANSPORT_BOUNDS');
    }
  }
  private async read<T>(path: string, context?: {LocationID?: string; OrganizationID?: string}): Promise<T> {
    for (let attempt = 0; attempt < this.options.maxAttempts; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
      let waitMs = 500 * 2 ** attempt;
      try {
        const response = await this.options.fetch(`https://api.last.app/v2${path}`, {
          method: 'GET', redirect: 'error', signal: controller.signal,
          headers: { Authorization: `Bearer ${this.options.token}`, ...context },
        });
        if (response.ok) return await response.json() as T;
        if (response.status === 401 || response.status === 403) throw new SalesSourceError('SOURCE_AUTH_FAILED', response.status);
        if (response.status !== 429 && response.status < 500) throw new SalesSourceError('SOURCE_HTTP_ERROR', response.status);
        const retryAfter = response.headers.get('Retry-After');
        if (retryAfter) {
          const seconds = Number(retryAfter);
          const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now();
          if (Number.isFinite(delay)) waitMs = Math.max(waitMs, delay);
        }
        // Do not retry early when the source asks for a delay beyond our execution budget.
        if (waitMs > 10000 || attempt === this.options.maxAttempts - 1) {
          throw new SalesSourceError(response.status === 429 ? 'SOURCE_RATE_LIMITED' : 'SOURCE_UNAVAILABLE', response.status);
        }
      } catch (error) {
        if (error instanceof SalesSourceError) throw error;
        if (attempt === this.options.maxAttempts - 1) throw new SalesSourceError(controller.signal.aborted ? 'SOURCE_TIMEOUT' : 'SOURCE_TRANSPORT_ERROR');
      } finally { clearTimeout(timer); }
      await this.options.sleep(waitMs);
    }
    throw new SalesSourceError('SOURCE_UNAVAILABLE');
  }
  private async *list<T>(entity: string, window: SourceWindow): AsyncIterable<SourcePage<T>> {
    const start = Date.parse(window.startDate), end = Date.parse(window.endDate), limit = window.limit ?? 100;
    if (!window.locationId || !Number.isFinite(start) || !Number.isFinite(end) || end <= start ||
      end - start > 365 * 86400000 || !Number.isInteger(limit) || limit < 5 || limit > 100 ||
      !Number.isSafeInteger(window.offset ?? 0) || (window.offset ?? 0) < 0) {
      throw new SalesSourceError('INVALID_SOURCE_WINDOW');
    }
    for (let page = 0; page < this.options.maxPages; page++) {
      const offset = (window.offset ?? 0) + page * limit;
      const query = new URLSearchParams({locationId: window.locationId, startDate: window.startDate, endDate: window.endDate,
        offset: String(offset), limit: String(limit)});
      const records = await this.read<T[]>(`/${entity}?${query}`, {LocationID: window.locationId});
      if (!Array.isArray(records) || records.length > limit) throw new SalesSourceError('SOURCE_INVALID_PAGE');
      yield { records, offset };
      if (records.length < limit) return;
    }
    throw new SalesSourceError('SOURCE_PAGE_BUDGET_EXCEEDED');
  }
  listOrganizations() { return this.read<Array<{id: string; name: string}>>('/organizations'); }
  listLocations(organizationId: string) { return this.read<Array<{id: string; name: string}>>(`/locations?organizationId=${encodeURIComponent(organizationId)}`, {OrganizationID: organizationId}); }
  listTabs(window: SourceWindow) { return this.list<SourceTab>('tabs', window); }
  listBills(window: SourceWindow) { return this.list<SourceBill>('bills', window); }
  listPayments(window: SourceWindow) { return this.list<SourcePayment>('payments', window); }
  getTab(locationId: string, id: string) { return this.read<SourceTab>(`/tabs/${encodeURIComponent(id)}`, {LocationID: locationId}); }
  getBill(locationId: string, id: string) { return this.read<SourceBill>(`/bills/${encodeURIComponent(id)}`, {LocationID: locationId}); }
  getPayment(locationId: string, id: string) { return this.read<SourcePayment>(`/payments/${encodeURIComponent(id)}`, {LocationID: locationId}); }
}
