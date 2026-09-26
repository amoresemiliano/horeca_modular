/** Strict two-decimal money. Existing UI numbers are bounded adapters to exact cents. */
export class MalformedMoneyError extends Error {
  constructor() {
    super('Invalid or missing monetary amount.');
    this.name = 'MalformedMoneyError';
  }
}

const MAX_CENTS = 99_999_999_999_999n;

function decimalCents(text: string): bigint {
  if (!/^[+-]?\d+(?:\.\d{1,2})?$/.test(text)) throw new MalformedMoneyError();
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace(/^[+-]/, '').split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents > MAX_CENTS) throw new MalformedMoneyError();
  return negative ? -cents : cents;
}

export function moneyToMinorUnits(amount: number): number {
  if (!Number.isFinite(amount)) throw new MalformedMoneyError();
  return Number(decimalCents(String(amount)));
}

export function moneyToDecimal(amount: number): string {
  const cents = BigInt(moneyToMinorUnits(amount));
  const absolute = cents < 0n ? -cents : cents;
  return `${cents < 0n ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

export function parseSpanishMoney(value: unknown): number {
  if (typeof value === 'number') return moneyToMinorUnits(value) / 100;
  if (typeof value !== 'string') throw new MalformedMoneyError();
  let text = value.trim().replace(/\s*(?:EUR|USD|GBP|\u20ac|\$|\u00a3)$/i, '').trim();
  if (text.endsWith('-')) text = '-' + text.slice(0, -1);
  // Text exports use European separators. Excel numeric cells are handled above.
  if (/^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text)) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else if (/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)\.\d{1,2}$/.test(text)) {
    text = text.replace(/,/g, '');
  } else {
    throw new MalformedMoneyError();
  }
  return Number(decimalCents(text)) / 100;
}

export function formatEuro(amount: number): string {
  return amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}
