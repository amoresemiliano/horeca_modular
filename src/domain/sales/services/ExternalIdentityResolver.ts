import { sha256Hex } from '../../../shared/utils/crypto';

export interface ExternalIdentityResolution {
  identityKey: string;
  algorithm: 'LASTAPP_INVOICE_V1' | 'LASTAPP_CODE_TIME_V1';
  discriminatorString: string;
}

export interface RawTicketRow {
  ubicacion?: string | null;
  codigo?: string | null;
  facturaNo?: string | null;
  horaCreacion?: string | null;
  [key: string]: unknown;
}

export class ExternalIdentityResolver {
  /**
   * Resolves a deterministic, tenant-scoped external identity key.
   * Invariant: Does NOT include mutable business data like 'Total' or 'payment_method'
   * in the identity, ensuring corrections re-exporting the same ticket with changed amounts
   * resolve to the exact same Sale identity.
   */
  public static resolveLastAppIdentity(
    organizationId: string,
    row: RawTicketRow
  ): ExternalIdentityResolution {
    if (!organizationId || organizationId.trim() === '') {
      throw new Error('Organization ID is mandatory for tenant-scoped external identity resolution');
    }

    const sourceSystem = 'lastapp';
    const location = (row.ubicacion || '').trim();
    const invoice = (row.facturaNo || '').trim();
    const code = (row.codigo || '').trim();
    const createdAt = (row.horaCreacion || '').trim();

    if (invoice) {
      // Primary deterministic key: organization + source + location + invoice
      const discriminator = [organizationId, sourceSystem, location, invoice].join('|');
      const identityKey = sha256Hex(discriminator);
      return {
        identityKey,
        algorithm: 'LASTAPP_INVOICE_V1',
        discriminatorString: discriminator,
      };
    }

    // Fallback deterministic key: organization + source + location + ticket code + creation time
    const discriminator = [organizationId, sourceSystem, location, code, createdAt].join('|');
    const identityKey = sha256Hex(discriminator);
    return {
      identityKey,
      algorithm: 'LASTAPP_CODE_TIME_V1',
      discriminatorString: discriminator,
    };
  }
}
