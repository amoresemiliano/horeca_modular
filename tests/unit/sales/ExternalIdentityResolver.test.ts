import { describe, it, expect } from 'vitest';
import { ExternalIdentityResolver } from '../../../src/domain/sales/services/ExternalIdentityResolver';

describe('ExternalIdentityResolver Unit Tests', () => {
  const orgId = 'org-uuid-1111';

  it('uses LASTAPP_INVOICE_V1 when invoice number is present', () => {
    const row = {
      ubicacion: 'El Criollo - Palencia',
      codigo: 'R001',
      facturaNo: 'LS2-10688',
      horaCreacion: '2026-08-01T11:59:51.000',
    };

    const res1 = ExternalIdentityResolver.resolveLastAppIdentity(orgId, row);
    expect(res1.algorithm).toBe('LASTAPP_INVOICE_V1');
    expect(res1.identityKey).toHaveLength(64); // sha256 hex length
    expect(res1.discriminatorString).toBe('org-uuid-1111|lastapp|El Criollo - Palencia|LS2-10688');

    // Deterministic replay check
    const res2 = ExternalIdentityResolver.resolveLastAppIdentity(orgId, row);
    expect(res2.identityKey).toBe(res1.identityKey);
  });

  it('uses LASTAPP_CODE_TIME_V1 fallback when invoice number is missing', () => {
    const row = {
      ubicacion: 'El Criollo - Palencia',
      codigo: 'R002',
      facturaNo: '',
      horaCreacion: '2026-08-01T12:03:31.000',
    };

    const res = ExternalIdentityResolver.resolveLastAppIdentity(orgId, row);
    expect(res.algorithm).toBe('LASTAPP_CODE_TIME_V1');
    expect(res.identityKey).toHaveLength(64);
    expect(res.discriminatorString).toBe('org-uuid-1111|lastapp|El Criollo - Palencia|R002|2026-08-01T12:03:31.000');
  });

  it('proves same ticket with corrected total produces the EXACT same external identity', () => {
    const rowOriginal = {
      ubicacion: 'El Criollo - Palencia',
      codigo: 'R001',
      facturaNo: 'LS2-10688',
      horaCreacion: '2026-08-01T11:59:51.000',
      total: '10.00',
    };

    const rowCorrected = {
      ubicacion: 'El Criollo - Palencia',
      codigo: 'R001',
      facturaNo: 'LS2-10688',
      horaCreacion: '2026-08-01T11:59:51.000',
      total: '15.00', // Changed amount in source
    };

    const resOrig = ExternalIdentityResolver.resolveLastAppIdentity(orgId, rowOriginal);
    const resCorr = ExternalIdentityResolver.resolveLastAppIdentity(orgId, rowCorrected);

    expect(resOrig.identityKey).toBe(resCorr.identityKey);
  });

  it('enforces tenant scoping (same ticket in Org A vs Org B generates distinct keys)', () => {
    const row = {
      ubicacion: 'El Criollo - Palencia',
      codigo: 'R001',
      facturaNo: 'LS2-10688',
      horaCreacion: '2026-08-01T11:59:51.000',
    };

    const resOrgA = ExternalIdentityResolver.resolveLastAppIdentity('org-A', row);
    const resOrgB = ExternalIdentityResolver.resolveLastAppIdentity('org-B', row);

    expect(resOrgA.identityKey).not.toBe(resOrgB.identityKey);
  });

  it('throws when organizationId is missing', () => {
    expect(() =>
      ExternalIdentityResolver.resolveLastAppIdentity('', { codigo: 'R001' })
    ).toThrowError(/Organization ID is mandatory/);
  });
});
