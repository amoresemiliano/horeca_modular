/**
 * bankParsers.js — Bridge adapter to canonical Finance domain parsers (WP-FIN-001)
 * Preserves legacy signatures while delegating to the canonical Finance engine.
 */

import { parseSpanishMoney } from '../domains/finance/domain/money';
import { parseSpanishDate as canonicalParseDate } from '../domains/finance/domain/dates';
import { computeSha256 } from '../domains/finance/domain/fingerprint';
import { detectBankSourceFormat } from '../domains/finance/infrastructure/parsers/BankFormatDetector';
import { parseBankStatementBuffer } from '../domains/finance/infrastructure/parsers';

export const ACCOUNTS_CONFIG = [
  { code: 'cta_mc',       name: 'Cuenta MC · BBVA',   bank_name: 'BBVA',     account_type: 'CUENTA'  },
  { code: 'cta_mt',       name: 'Cuenta MT · BBVA',   bank_name: 'BBVA',     account_type: 'CUENTA'  },
  { code: 'tarj_bbva',    name: 'Tarjeta · BBVA',     bank_name: 'BBVA',     account_type: 'TARJETA' },
  { code: 'cta_sabadell', name: 'Cuenta · Sabadell',  bank_name: 'Sabadell', account_type: 'CUENTA'  },
  { code: 'tarj_sabadell',name: 'Tarjeta · Sabadell', bank_name: 'Sabadell', account_type: 'TARJETA' },
];

export async function computeFileHash(arrayBuffer) {
  return computeSha256(arrayBuffer);
}

export function parseSpanishAmount(val) {
  return parseSpanishMoney(val);
}

export function parseSpanishDate(val, fallbackYear = 2026) {
  return canonicalParseDate(val, { contextYear: fallbackYear });
}

export function detectBankFormat(jsonRows, fileName = '') {
  try {
    const res = detectBankSourceFormat(jsonRows);
    if (res.formatFamily === 'BBVA_ACCOUNT') {
      if (fileName.toUpperCase().includes('MT')) return 'cta_mt';
      return 'cta_mc';
    }
    if (res.formatFamily === 'BBVA_CARD') return 'tarj_bbva';
    if (res.formatFamily === 'SABADELL_ACCOUNT') return 'cta_sabadell';
    if (res.formatFamily === 'SABADELL_CARD') return 'tarj_sabadell';
  } catch {
    const nameUpper = fileName.toUpperCase();
    if (nameUpper.includes('BBVA')) {
      if (nameUpper.includes('TARJ')) return 'tarj_bbva';
      if (nameUpper.includes('MT')) return 'cta_mt';
      return 'cta_mc';
    }
    if (nameUpper.includes('SABADELL')) {
      if (nameUpper.includes('TARJ')) return 'tarj_sabadell';
      return 'cta_sabadell';
    }
  }
  return 'cta_mc';
}

export async function parseBankStatementFile(arrayBuffer, fileName) {
  const { parsedResult, detection } = await parseBankStatementBuffer(arrayBuffer, fileName);
  
  let legacyAccountCode = 'cta_mc';
  if (detection.formatFamily === 'BBVA_ACCOUNT') {
    legacyAccountCode = fileName.toUpperCase().includes('MT') ? 'cta_mt' : 'cta_mc';
  } else if (detection.formatFamily === 'BBVA_CARD') {
    legacyAccountCode = 'tarj_bbva';
  } else if (detection.formatFamily === 'SABADELL_ACCOUNT') {
    legacyAccountCode = 'cta_sabadell';
  } else if (detection.formatFamily === 'SABADELL_CARD') {
    legacyAccountCode = 'tarj_sabadell';
  }

  const accountMeta = ACCOUNTS_CONFIG.find(a => a.code === legacyAccountCode) || ACCOUNTS_CONFIG[0];

  const mappedMovements = parsedResult.movements.map((m) => ({
    source_row_number: m.sourceRowNumber,
    row_identity_key: `${m.sourceRowNumber}_${m.bookingDate}_${m.amount}`,
    overlap_hash: `${legacyAccountCode}_${m.bookingDate}_${m.amount.toFixed(2)}_${m.description.substring(0, 40)}`,
    fecha: m.bookingDate,
    fecha_valor: m.valueDate || m.bookingDate,
    monto: m.amount,
    original_description: m.description,
    normalized_description: m.description.toUpperCase(),
    raw_payload: m.minimizedProvenance,
  }));

  return {
    file_name: fileName,
    file_hash: parsedResult.fileHash,
    account_code: legacyAccountCode,
    account_meta: accountMeta,
    total_raw_rows: parsedResult.totalRawRows,
    movements: mappedMovements,
    canonical_result: parsedResult,
  };
}
