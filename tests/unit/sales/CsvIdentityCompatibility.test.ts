import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Papa from 'papaparse';
import vectors from '../../fixtures/sales/sha256-reviewed-vectors.json';
import { sha256Hex } from '../../../src/shared/utils/crypto';
import { ExternalIdentityResolver } from '../../../src/domain/sales/services/ExternalIdentityResolver';

describe('CSV SHA-256 compatibility with reviewed 5e767ec', () => {
  it.each(vectors.hashes.map((vector, index) => ({ ...vector, index })))('preserves frozen hash vector $index', ({ input, hash }) => {
    expect(sha256Hex(input)).toBe(hash);
    // Preserve the reviewed helper's low-byte encoding, including Unicode.
    // Node crypto is an independent test oracle only; runtime stays universal.
    const bytes = Uint8Array.from(input.split(''), char => char.charCodeAt(0) & 0xff);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(hash);
  });

  it.each(vectors.hashes.slice(-4))('preserves identity discriminator $input', ({ input, hash }) => {
    const [org, , location, identifier, time] = input.split('|');
    expect(ExternalIdentityResolver.resolveLastAppIdentity(org, {
      ubicacion: ` ${location} `,
      facturaNo: time ? '' : ` ${identifier} `,
      codigo: time ? ` ${identifier} ` : 'ignored',
      horaCreacion: time ? ` ${time} ` : 'ignored',
    })).toEqual({
      identityKey: hash,
      discriminatorString: input,
      algorithm: time ? 'LASTAPP_CODE_TIME_V1' : 'LASTAPP_INVOICE_V1',
    });
  });

  it.each(vectors.fixtures)('preserves every identity and the file hash for $filename', ({ filename, rows, fileHash, identitiesHash }) => {
    const content = readFileSync(`tests/fixtures/sales/lastapp/${filename}`, 'utf8');
    expect(sha256Hex(content)).toBe(fileHash);
    const parsed = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true });
    expect(parsed.data).toHaveLength(rows);
    const keys = parsed.data.map(row => ExternalIdentityResolver.resolveLastAppIdentity('org-elcriollo-palencia', {
      ubicacion: row['Ubicación'], facturaNo: row['Factura nº'],
      codigo: row['Código'], horaCreacion: row['Hora de creación'],
    }).identityKey);
    expect(sha256Hex(keys.join('\n'))).toBe(identitiesHash);
  });
});
