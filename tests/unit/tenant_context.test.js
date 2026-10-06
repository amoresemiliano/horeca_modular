import { describe, expect, it, vi } from 'vitest';
import { moduleEnabled, resolveAuthorizedCapabilities, selectOrganization } from '../../src/context/tenantContext.js';

describe('Core browser tenant context (RPC mocked; not hosted proof)', () => {
  const a = { id: 'a' }, b = { id: 'b' };
  it('auto-selects only a single organization, preserves explicit selection, and rejects foreign selection', () => {
    expect(selectOrganization([a], null, null)).toEqual(a);
    expect(selectOrganization([a, b], null, null)).toBeNull();
    expect(selectOrganization([a, b], 'b', 'a')).toEqual(b);
    expect(selectOrganization([a, b], null, 'b')).toEqual(b);
    expect(selectOrganization([a], 'foreign', null)).toBeNull();
    expect(selectOrganization([a], null, 'removed')).toBeNull();
    expect(selectOrganization([], null, null)).toBeNull();
  });
  it('requires the explicit enabled entitlement and selected organization', () => {
    expect(moduleEnabled('a', [], 'bancos')).toBe(false);
    expect(moduleEnabled('a', [{ module_key: 'other', is_enabled: true }], 'bancos')).toBe(false);
    expect(moduleEnabled('a', [{ module_key: 'bancos', is_enabled: false }], 'bancos')).toBe(false);
    expect(moduleEnabled(null, [{ module_key: 'bancos', is_enabled: true }], 'bancos')).toBe(false);
    expect(moduleEnabled('a', [{ module_key: 'bancos', is_enabled: true }], 'bancos')).toBe(true);
  });
  it('keeps platform login neutral even with one tenant and supports explicit deselection', () => {
    expect(selectOrganization([a], null, null, true)).toBeNull();
    expect(selectOrganization([a, b], 'a', null, true)).toEqual(a);
    expect(selectOrganization([a, b], '', 'a', true)).toBeNull();
    expect(selectOrganization([a, b], null, 'b', true)).toEqual(b);
    expect(selectOrganization([a, b], 'foreign', 'a', true)).toBeNull();
  });
  it('does not turn candidate grants into authority when the canonical gate denies', async () => {
    const client = { rpc: vi.fn().mockResolvedValueOnce({ data: false }).mockResolvedValueOnce({ data: true }) };
    expect(await resolveAuthorizedCapabilities(client, 'b', ['revoked', 'allowed'])).toEqual(['allowed']);
    expect(client.rpc).toHaveBeenCalledWith('can_execute_capability_for_org', {
      requested_organization_id: 'b', required_capability_code: 'revoked', requested_operational_unit_id: null,
    });
  });
  it('passes explicit unit scope and fails closed on unavailable authorization', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: new Error('unavailable') }) };
    await expect(resolveAuthorizedCapabilities(client, 'a', ['cap'], 'unit')).rejects.toThrow('unavailable');
    expect(client.rpc.mock.calls[0][1].requested_operational_unit_id).toBe('unit');
  });
  it('never manufactures capabilities for a legacy role with no canonical grants', async () => {
    const client = { rpc: vi.fn() };
    expect(await resolveAuthorizedCapabilities(client, 'a', [])).toEqual([]);
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
