import { moneyToDecimal } from './money';
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

  throw new Error('SHA-256 is unavailable in this environment.');
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
  const amountStr = moneyToDecimal(input.amount);
  const balanceStr = input.runningBalance !== null && input.runningBalance !== undefined
    ? moneyToDecimal(input.runningBalance)
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
  ].map(value => JSON.stringify(value)).join('|');
}

export async function generateMovementFingerprint(input: MovementFingerprintInput): Promise<string> {
  const rawString = generateMovementFingerprintString(input);
  return computeSha256(rawString);
}
