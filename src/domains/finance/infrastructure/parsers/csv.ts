import Papa from 'papaparse';
import {detectBankSourceFormat} from './BankFormatDetector';

/** Strict text transport: never let spreadsheet inference coerce dates or money. */
export function readBankCsv(bytes: Uint8Array): string[][] {
  let text: string;
  try { text = new TextDecoder('utf-8', {fatal:true}).decode(bytes).replace(/^\uFEFF/, ''); }
  catch { throw Error('CSV no compatible: se requiere UTF-8 válido.'); }
  if (!text.trim() || text.includes('\0')) throw Error('CSV vacío o no compatible.');
  const candidates: string[][][] = [];
  for (const delimiter of [',',';','\t','|']) {
    const result = Papa.parse<string[]>(text, {delimiter, dynamicTyping:false, skipEmptyLines:'greedy'});
    if (result.errors.length) continue;
    const rows = result.data;
    const header = rows.slice(0,30).findIndex(row => row.length >= 4 && row.some(x=>x.trim().toUpperCase()==='IMPORTE'));
    if (header < 0) continue;
    const labels=rows[header].map(x=>x.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase()).filter(Boolean);
    if(new Set(labels).size!==labels.length)continue;
    const width = rows[header].length;
    if (rows.slice(header+1).some(row=>row.length!==width && !/^(TOTAL|SALDO (ANTERIOR|INICIAL|FINAL))\b/i.test(row.find(x=>x.trim())||''))) continue;
    try { detectBankSourceFormat(rows); candidates.push(rows); } catch { /* Try the next structural delimiter. */ }
  }
  if (candidates.length !== 1) throw Error(candidates.length ? 'CSV ambiguo: revisa el delimitador y las columnas.' : 'CSV no compatible o mal formado: revisa cabeceras, comillas y columnas.');
  return candidates[0];
}
