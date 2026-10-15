import { decimalAtoms, decimalString } from './quantities';

export function evaluateRequirement(minimum: string, maximum: string, actual: string | null) {
  const min = decimalAtoms(minimum), max = decimalAtoms(maximum);
  if (min < 0n || max < min) throw new Error('INVALID_PLANNING_LIMITS');
  if (actual === null) return { state: 'UNKNOWN' as const, suggestedQuantity: null };
  const stock = decimalAtoms(actual);
  // Compare four times the amount to avoid rounding a fractional boundary.
  const state = stock < min ? 'CRITICAL' : stock * 4n < min * 3n + max ? 'NECESSARY' : stock > max ? 'EXCESS' : 'OPTIMAL';
  return { state, suggestedQuantity: state === 'CRITICAL' || state === 'NECESSARY' ? decimalString(max - stock) : '0.000000' };
}
