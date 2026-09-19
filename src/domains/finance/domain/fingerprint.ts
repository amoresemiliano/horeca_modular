/**
 * HORECA Modular — Deterministic Cryptographic Hashes & Fingerprints (WP-FIN-001)
 * Multi-layer Idempotency:
 * - Level A: Source File SHA-256
 * - Level B: Bank Native Identity (where provided by institution)
 * - Level C: Canonical Movement Fingerprint
 */

export async function computeSha256(data: ArrayBuffer | string): Promise<string> {
  let buffer: ArrayBuffer;
  if (typeof data === 'string') {
    buffer = new TextEncoder().encode(data).buffer;
  } else {
    buffer = data;
  }

  // Use crypto.subtle in modern environments (Browser, Node 18+)
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback for older Node runtimes if needed
  try {
    const cryptoModule = await import('crypto');
    return cryptoModule.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
  } catch {
    // Basic deterministic string hash fallback
    const view = new Uint8Array(buffer);
    let hash = 0;
    for (let i = 0; i < view.length; i++) {
      hash = ((hash << 5) - hash) + view[i];
      hash |= 0;
    }
    return 'fallback_hash_' + Math.abs(hash).toString(16);
  }
}

export interface MovementFingerprintInput {
  bankAccountId: string;
  bookingDate: string;
  valueDate?: string | null;
  amount: number;
  normalizedDescription: string;
  runningBalance?: number | null;
  bankNativeId?: string | null;
  externalReference?: string | null;
}

export function generateMovementFingerprintString(input: MovementFingerprintInput): string {
  const normDesc = input.normalizedDescription.trim().toUpperCase().replace(/\s+/g, ' ');
  const amountStr = input.amount.toFixed(2);
  const balanceStr = input.runningBalance !== null && input.runningBalance !== undefined 
    ? input.runningBalance.toFixed(2) 
    : '';
  const valDateStr = input.valueDate || '';
  const nativeIdStr = input.bankNativeId || '';
  const extRefStr = input.externalReference || '';

  return [
    input.bankAccountId,
    input.bookingDate,
    valDateStr,
    amountStr,
    normDesc,
    balanceStr,
    nativeIdStr,
    extRefStr
  ].join('|');
}

export async function generateMovementFingerprint(input: MovementFingerprintInput): Promise<string> {
  const rawString = generateMovementFingerprintString(input);
  return computeSha256(rawString);
}
