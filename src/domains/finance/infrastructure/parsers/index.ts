/**
 * HORECA Modular — Bank Statement Parser Engine (WP-FIN-001)
 * Entry point for reading and normalizing bank files (.xls / .xlsx)
 */

import * as XLSX from 'xlsx';
import { ParsedBankFileResult } from '../../domain/types';
import { computeSha256 } from '../../domain/fingerprint';
import { detectBankSourceFormat, DetectionResult } from './BankFormatDetector';
import { parseBbvaAccount } from './BbvaAccountParser';
import { parseBbvaCard } from './BbvaCardParser';
import { parseSabadellAccount } from './SabadellAccountParser';
import { parseSabadellCard } from './SabadellCardParser';

export { detectBankSourceFormat } from './BankFormatDetector';
export type { DetectionResult } from './BankFormatDetector';
export { parseBbvaAccount } from './BbvaAccountParser';
export { parseBbvaCard } from './BbvaCardParser';
export { parseSabadellAccount } from './SabadellAccountParser';
export { parseSabadellCard } from './SabadellCardParser';

export async function parseBankStatementBuffer(
  arrayBuffer: ArrayBuffer,
  fileName: string
): Promise<{ parsedResult: ParsedBankFileResult; detection: DetectionResult }> {
  const fileHash = await computeSha256(arrayBuffer);
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('El archivo no contiene ninguna hoja de cálculo válida.');
  }

  const primarySheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonRows = XLSX.utils.sheet_to_json(primarySheet, { header: 1, raw: false }) as Array<any[]>;

  const detection = detectBankSourceFormat(jsonRows, workbook.SheetNames);

  let parsedResult: ParsedBankFileResult;

  switch (detection.formatFamily) {
    case 'BBVA_ACCOUNT':
      parsedResult = parseBbvaAccount(jsonRows, fileName, fileHash, detection);
      break;
    case 'BBVA_CARD':
      parsedResult = parseBbvaCard(jsonRows, fileName, fileHash, detection);
      break;
    case 'SABADELL_ACCOUNT':
      parsedResult = parseSabadellAccount(jsonRows, fileName, fileHash, detection);
      break;
    case 'SABADELL_CARD':
      parsedResult = parseSabadellCard(jsonRows, fileName, fileHash, detection);
      break;
    default:
      throw new Error(`Formato bancario '${detection.formatFamily}' no soportado.`);
  }

  return { parsedResult, detection };
}
