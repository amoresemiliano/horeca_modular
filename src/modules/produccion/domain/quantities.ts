/** Canonical quantities are decimal strings with six-place fixed-point arithmetic. */
export type ProductionUnit = 'kg' | 'g' | 'L' | 'ml' | 'unit';
const scale = 1_000_000n;
const limit = 10n ** 20n;

export function decimalAtoms(value: string): bigint {
  if (typeof value !== 'string' || !/^-?\d{1,14}(\.\d{1,6})?$/.test(value)) throw new Error('INVALID_DECIMAL');
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = value.replace(/^-/, '').split('.');
  const atoms = BigInt(whole) * scale + BigInt(fraction.padEnd(6, '0'));
  if (atoms >= limit) throw new Error('QUANTITY_OVERFLOW');
  return negative ? -atoms : atoms;
}

export function decimalString(atoms: bigint): string {
  if (atoms <= -limit || atoms >= limit) throw new Error('QUANTITY_OVERFLOW');
  const abs = atoms < 0n ? -atoms : atoms;
  return `${atoms < 0n ? '-' : ''}${abs / scale}.${(abs % scale).toString().padStart(6, '0')}`;
}

export function packagedQuantity(count: number, netQuantity: string): string {
  if (!Number.isSafeInteger(count) || count <= 0 || count > 2_147_483_647) throw new Error('INVALID_PACKAGE_COUNT');
  const quantity = decimalAtoms(netQuantity);
  if (quantity <= 0n) throw new Error('UNKNOWN_OR_INVALID_CONVERSION');
  return decimalString(quantity * BigInt(count));
}
