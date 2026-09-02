/**
 * bankParsers.js — Parser de Extractos Bancarios (Track A)
 * Soporta los 5 formatos reales:
 *  1. BBVA Cuenta MC
 *  2. BBVA Cuenta MT
 *  3. BBVA Tarjeta
 *  4. Sabadell Cuenta
 *  5. Sabadell Tarjeta
 */
import * as XLSX from 'xlsx';

export const ACCOUNTS_CONFIG = [
  { code: 'cta_mc',       name: 'Cuenta MC · BBVA',   bank_name: 'BBVA',     account_type: 'CUENTA'  },
  { code: 'cta_mt',       name: 'Cuenta MT · BBVA',   bank_name: 'BBVA',     account_type: 'CUENTA'  },
  { code: 'tarj_bbva',    name: 'Tarjeta · BBVA',     bank_name: 'BBVA',     account_type: 'TARJETA' },
  { code: 'cta_sabadell', name: 'Cuenta · Sabadell',  bank_name: 'Sabadell', account_type: 'CUENTA'  },
  { code: 'tarj_sabadell',name: 'Tarjeta · Sabadell', bank_name: 'Sabadell', account_type: 'TARJETA' },
];

export async function computeFileHash(arrayBuffer) {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  const view = new Uint8Array(arrayBuffer);
  let hash = 0;
  for (let i = 0; i < view.length; i++) {
    hash = ((hash << 5) - hash) + view[i];
    hash |= 0;
  }
  return 'simple_hash_' + Math.abs(hash);
}

export function parseSpanishAmount(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  let str = String(val).trim().replace(/€/g, '').replace(/\s/g, '');
  if (!str) return 0;
  
  if (str.includes('.') && str.includes(',')) {
    if (str.indexOf('.') < str.indexOf(',')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

export function parseSpanishDate(val, fallbackYear = 2026) {
  if (!val) return null;
  const str = String(val).trim();
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  
  const matchFull = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (matchFull) {
    const [, d, m, y] = matchFull;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  
  const matchShort = str.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (matchShort) {
    const [, d, m] = matchShort;
    return `${fallbackYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return str;
}

export function detectBankFormat(jsonRows, fileName = '') {
  const nameUpper = fileName.toUpperCase();
  
  for (let i = 0; i < Math.min(25, jsonRows.length); i++) {
    const rowStr = (jsonRows[i] || []).map(cell => String(cell || '').toUpperCase()).join(' ');
    
    if (rowStr.includes('F. CONTABLE') && rowStr.includes('CÓDIGO') && rowStr.includes('IMPORTE')) {
      if (nameUpper.includes('MT')) return 'cta_mt';
      return 'cta_mc';
    }
    
    if (rowStr.includes('FECHA DE OPERACIÓN') || rowStr.includes('EXTRACTO DE TARJETA')) {
      return 'tarj_bbva';
    }
    
    if (rowStr.includes('F. OPERATIVA') && rowStr.includes('CONCEPTO') && rowStr.includes('SALDO')) {
      return 'cta_sabadell';
    }
    
    if (rowStr.includes('MOVIMIENTOS DE CREDITO') || (rowStr.includes('LOCALIDAD') && rowStr.includes('CONCEPTO'))) {
      return 'tarj_sabadell';
    }
  }
  
  if (nameUpper.includes('BBVA')) {
    if (nameUpper.includes('TARJ')) return 'tarj_bbva';
    if (nameUpper.includes('MT')) return 'cta_mt';
    return 'cta_mc';
  }
  if (nameUpper.includes('SABADELL')) {
    if (nameUpper.includes('TARJ')) return 'tarj_sabadell';
    return 'cta_sabadell';
  }
  
  return 'cta_mc';
}

export async function parseBankStatementFile(arrayBuffer, fileName) {
  const fileHash = await computeFileHash(arrayBuffer);
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
  
  const accountCode = detectBankFormat(jsonRows, fileName);
  const accountMeta = ACCOUNTS_CONFIG.find(a => a.code === accountCode) || ACCOUNTS_CONFIG[0];

  const parsedMovements = [];
  let headerRowIndex = -1;
  let headers = [];
  
  for (let i = 0; i < Math.min(25, jsonRows.length); i++) {
    const row = jsonRows[i] || [];
    const rowStr = row.map(cell => String(cell || '').toUpperCase()).join(' ');
    if (
      rowStr.includes('F. CONTABLE') || 
      rowStr.includes('FECHA DE OPERACIÓN') || 
      rowStr.includes('F. OPERATIVA') || 
      rowStr.includes('LOCALIDAD')
    ) {
      headerRowIndex = i;
      headers = row.map(cell => String(cell || '').toUpperCase().trim());
      break;
    }
  }

  const startRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
  
  for (let rIdx = startRow; rIdx < jsonRows.length; rIdx++) {
    const row = jsonRows[rIdx];
    if (!row || row.length === 0) continue;
    
    // Filter empty leading cells
    const nonNullRow = row.filter(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
    if (nonNullRow.length < 2) continue;

    let dateVal = null;
    let dateValueVal = null;
    let amountVal = 0;
    let concept = '';
    let beneficiary = '';
    let obs = '';

    if (accountCode === 'cta_mc' || accountCode === 'cta_mt') {
      // Find indexes in headers or scanning row
      const dateIdx = headers.indexOf('F. CONTABLE') >= 0 ? headers.indexOf('F. CONTABLE') : 2;
      const valueDateIdx = headers.indexOf('F. VALOR') >= 0 ? headers.indexOf('F. VALOR') : 3;
      const conceptIdx = headers.indexOf('CONCEPTO') >= 0 ? headers.indexOf('CONCEPTO') : 5;
      const benIdx = headers.indexOf('BENEFICIARIO/ORDENANTE') >= 0 ? headers.indexOf('BENEFICIARIO/ORDENANTE') : 6;
      const obsIdx = headers.indexOf('OBSERVACIONES') >= 0 ? headers.indexOf('OBSERVACIONES') : 7;
      const amountIdx = headers.indexOf('IMPORTE') >= 0 ? headers.indexOf('IMPORTE') : 8;

      dateVal = row[dateIdx];
      dateValueVal = row[valueDateIdx];
      concept = row[conceptIdx] || '';
      beneficiary = row[benIdx] || '';
      obs = row[obsIdx] || '';
      amountVal = parseSpanishAmount(row[amountIdx]);

    } else if (accountCode === 'tarj_bbva') {
      const dateIdx = headers.indexOf('FECHA DE OPERACIÓN') >= 0 ? headers.indexOf('FECHA DE OPERACIÓN') : 2;
      const conceptIdx = headers.indexOf('CONCEPTO') >= 0 ? headers.indexOf('CONCEPTO') : 3;
      const amountIdx = headers.indexOf('IMPORTE') >= 0 ? headers.indexOf('IMPORTE') : 5;

      dateVal = row[dateIdx];
      concept = row[conceptIdx] || '';
      amountVal = parseSpanishAmount(row[amountIdx]);

    } else if (accountCode === 'cta_sabadell') {
      dateVal = row[0];
      concept = row[1] || '';
      dateValueVal = row[2];
      amountVal = parseSpanishAmount(row[3]);
      obs = [row[5], row[6]].filter(Boolean).join(' ');

    } else if (accountCode === 'tarj_sabadell') {
      dateVal = row[0];
      concept = row[1] || '';
      obs = row[2] || '';
      let rawAmount = parseSpanishAmount(row[4]);
      amountVal = rawAmount > 0 ? -rawAmount : rawAmount;
    }

    const formattedDate = parseSpanishDate(dateVal);
    const formattedDateValue = parseSpanishDate(dateValueVal) || formattedDate;
    
    if (!formattedDate || isNaN(amountVal) || amountVal === 0) continue;

    const originalDesc = [concept, beneficiary, obs].filter(Boolean).join(' · ').trim();
    const normalizedDesc = originalDesc.toUpperCase().replace(/\s+/g, ' ');
    
    const rowIdentityKey = `${rIdx}_${formattedDate}_${amountVal}_${normalizedDesc.substring(0, 30)}`;
    const overlapHash = `${accountCode}_${formattedDate}_${amountVal.toFixed(2)}_${normalizedDesc.substring(0, 40)}`;

    parsedMovements.push({
      source_row_number: rIdx + 1,
      row_identity_key: rowIdentityKey,
      overlap_hash: overlapHash,
      fecha: formattedDate,
      fecha_valor: formattedDateValue,
      monto: amountVal,
      original_description: originalDesc,
      normalized_description: normalizedDesc,
      raw_payload: row,
    });
  }

  return {
    file_name: fileName,
    file_hash: fileHash,
    account_code: accountCode,
    account_meta: accountMeta,
    total_raw_rows: jsonRows.length,
    movements: parsedMovements,
  };
}
