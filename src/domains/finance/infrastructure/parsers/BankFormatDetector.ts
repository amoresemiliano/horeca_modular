/**
 * HORECA Modular — Bank Format Detector (WP-FIN-001)
 * Detects the 4 canonical banking format families based on structural content & headers.
 * Extracts embedded bank account/contract metadata without relying on filenames.
 */

import { BankFormatFamily, BankAccountMetadata } from '../../domain/types';

export interface DetectionResult {
  formatFamily: BankFormatFamily;
  metadata: BankAccountMetadata;
  confidence: number;
  detectionMarkers: string[];
}

export class FormatDetectionError extends Error {
  public readonly isFormatDetectionError = true;
  constructor(message: string, public readonly reason: 'UNSUPPORTED' | 'AMBIGUOUS' | 'EMPTY') {
    super(message);
    this.name = 'FormatDetectionError';
  }
}

export function detectBankSourceFormat(
  rows: Array<any[]>,
  sheetNames: string[] = []
): DetectionResult {
  if (!rows || rows.length === 0) {
    throw new FormatDetectionError('El archivo bancario está vacío o no contiene filas legibles.', 'EMPTY');
  }

  const scores: Record<BankFormatFamily, { score: number; markers: string[] }> = {
    BBVA_ACCOUNT: { score: 0, markers: [] },
    BBVA_CARD: { score: 0, markers: [] },
    SABADELL_ACCOUNT: { score: 0, markers: [] },
    SABADELL_CARD: { score: 0, markers: [] }
  };

  const sheetNamesUpper = sheetNames.map(s => s.toUpperCase());
  if (sheetNamesUpper.includes('HISTORICO')) {
    scores.BBVA_ACCOUNT.score += 2;
    scores.BBVA_ACCOUNT.markers.push('Sheet: Historico');
  }
  if (sheetNamesUpper.some(s => s.includes('LISTADO') || s.includes('MOVIMIENTOS') || s.includes('PLASTICO'))) {
    scores.BBVA_CARD.score += 2;
    scores.BBVA_CARD.markers.push('Sheet: Listado/Movimientos/Plastico');
  }
  if (sheetNamesUpper.includes('HOJA1')) {
    scores.SABADELL_ACCOUNT.score += 1;
    scores.SABADELL_ACCOUNT.markers.push('Sheet: Hoja1');
  }
  if (sheetNamesUpper.includes('SHEET0')) {
    scores.SABADELL_CARD.score += 1;
    scores.SABADELL_CARD.markers.push('Sheet: Sheet0');
  }

  // Scan top 30 rows for structural markers
  const maxScanRows = Math.min(30, rows.length);
  const metadata: BankAccountMetadata = {};

  for (let i = 0; i < maxScanRows; i++) {
    const row = rows[i] || [];
    const rowStr = row.map(c => String(c || '').trim().toUpperCase()).join(' ');

    // ── 1. BBVA ACCOUNT MARKERS ──────────────────────────────────────────
    if (rowStr.includes('F. CONTABLE') && rowStr.includes('F. VALOR') && rowStr.includes('IMPORTE')) {
      scores.BBVA_ACCOUNT.score += 10;
      scores.BBVA_ACCOUNT.markers.push('Header: F. CONTABLE + F. VALOR + IMPORTE');
    }
    if (rowStr.includes('BENEFICIARIO/ORDENANTE') || rowStr.includes('OBSERVACIONES')) {
      scores.BBVA_ACCOUNT.score += 4;
      scores.BBVA_ACCOUNT.markers.push('Column: BENEFICIARIO/ORDENANTE');
    }
    if (rowStr.includes('BANCO BILBAO VIZCAYA')) {
      scores.BBVA_ACCOUNT.score += 3;
      scores.BBVA_ACCOUNT.markers.push('Entity: BANCO BILBAO VIZCAYA');
    }

    // Extract BBVA Account IBAN & Titular from metadata rows
    if (rowStr.includes('CUENTA') && !metadata.iban) {
      for (const cell of row) {
        const cStr = String(cell || '').trim();
        if (/^ES\d{20,24}$/i.test(cStr.replace(/\s+/g, ''))) {
          metadata.iban = cStr.replace(/\s+/g, '');
          metadata.maskedIdentifier = `•••• ${metadata.iban.slice(-4)}`;
        }
      }
    }
    if (rowStr.includes('TITULAR') && !metadata.holderName) {
      for (const cell of row) {
        const cStr = String(cell || '').trim();
        if (cStr && !cStr.toUpperCase().includes('TITULAR') && cStr.length > 3) {
          metadata.holderName = cStr;
        }
      }
    }

    // ── 2. BBVA CARD MARKERS ─────────────────────────────────────────────
    if (rowStr.includes('FECHA DE OPERACIÓN') && rowStr.includes('TIPO DE MOVIMIENTO') && rowStr.includes('IMPORTE')) {
      scores.BBVA_CARD.score += 10;
      scores.BBVA_CARD.markers.push('Header: FECHA DE OPERACIÓN + TIPO DE MOVIMIENTO + IMPORTE');
    }
    if (rowStr.includes('EXTRACTO DE TARJETA') || rowStr.includes('TIPO DE CONTRATO')) {
      scores.BBVA_CARD.score += 6;
      scores.BBVA_CARD.markers.push('Metadata: EXTRACTO DE TARJETA / TIPO DE CONTRATO');
    }
    if (rowStr.includes('Nº DE CONTRATO') || rowStr.includes('NO DE CONTRATO')) {
      scores.BBVA_CARD.score += 4;
      scores.BBVA_CARD.markers.push('Metadata: Nº DE CONTRATO');
      for (const cell of row) {
        const cStr = String(cell || '').trim();
        if (/^\d{16,28}$/.test(cStr)) {
          metadata.contractNumber = cStr;
          metadata.maskedIdentifier = `Contrato •••• ${cStr.slice(-4)}`;
        }
      }
    }

    // ── 3. SABADELL ACCOUNT MARKERS ──────────────────────────────────────
    if (rowStr.includes('F. OPERATIVA') && rowStr.includes('CONCEPTO') && rowStr.includes('SALDO')) {
      scores.SABADELL_ACCOUNT.score += 10;
      scores.SABADELL_ACCOUNT.markers.push('Header: F. OPERATIVA + CONCEPTO + SALDO');
    }
    if (rowStr.includes('CONSULTA DE MOVIMIENTOS') || (rowStr.includes('REFERENCIA 1') && rowStr.includes('REFERENCIA 2'))) {
      scores.SABADELL_ACCOUNT.score += 5;
      scores.SABADELL_ACCOUNT.markers.push('Header: CONSULTA DE MOVIMIENTOS / REFERENCIAS');
    }
    if (rowStr.includes('CUENTA:') && !metadata.iban) {
      for (const cell of row) {
        const cStr = String(cell || '').trim();
        if (/^ES\d{20,24}$/i.test(cStr.replace(/\s+/g, ''))) {
          metadata.iban = cStr.replace(/\s+/g, '');
          metadata.maskedIdentifier = `•••• ${metadata.iban.slice(-4)}`;
        }
      }
    }

    // ── 4. SABADELL CARD MARKERS ─────────────────────────────────────────
    if (rowStr.includes('MOVIMIENTOS DE CREDITO') || (rowStr.includes('LOCALIDAD') && rowStr.includes('IMPORTE'))) {
      scores.SABADELL_CARD.score += 10;
      scores.SABADELL_CARD.markers.push('Header: MOVIMIENTOS DE CREDITO / LOCALIDAD');
    }
    if (rowStr.includes('SALDOS Y MOVIMIENTOS') || rowStr.includes('SALDO DISPUESTO:') || rowStr.includes('CUENTA RELACIONADA')) {
      scores.SABADELL_CARD.score += 5;
      scores.SABADELL_CARD.markers.push('Metadata: SALDOS Y MOVIMIENTOS / CUENTA RELACIONADA');
    }
    if (rowStr.includes('TARJETA:') && !metadata.cardIdentifier) {
      for (const cell of row) {
        const cStr = String(cell || '').trim();
        if (/^\d{16}$/.test(cStr)) {
          metadata.cardIdentifier = cStr;
          metadata.maskedIdentifier = `Tarjeta •••• ${cStr.slice(-4)}`;
        } else if (cStr && !cStr.toUpperCase().includes('TARJETA') && cStr.length > 5) {
          metadata.contractNumber = cStr;
        }
      }
    }
  }

  // Find highest scoring family
  const sorted = (Object.keys(scores) as BankFormatFamily[]).sort(
    (a, b) => scores[b].score - scores[a].score
  );

  const topFamily = sorted[0];
  const topScore = scores[topFamily].score;
  const runnerUpFamily = sorted[1];
  const runnerUpScore = scores[runnerUpFamily].score;

  if (topScore < 5) {
    throw new FormatDetectionError(
      'Formato de archivo no reconocido. El archivo no contiene la estructura esperada para BBVA o Banco Sabadell.',
      'UNSUPPORTED'
    );
  }

  // If top score and runner up score are too close (and both high), detect ambiguity
  if (topScore === runnerUpScore && topScore > 5) {
    throw new FormatDetectionError(
      `Detección ambigua entre ${topFamily} y ${runnerUpFamily}. Se requiere especificación manual.`,
      'AMBIGUOUS'
    );
  }

  return {
    formatFamily: topFamily,
    metadata,
    confidence: Math.min(100, Math.round((topScore / 15) * 100)),
    detectionMarkers: scores[topFamily].markers
  };
}
