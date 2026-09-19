import { SaleLineItemType } from '../models/SaleLine';

export interface ParsedProductLine {
  lineIndex: number;
  depth: number;
  parentLineIndex?: number | null;
  rawText: string;
  displayText: string;
  quantity: number;
  itemType: SaleLineItemType;
  notes?: string | null;
}

export class ProductLineParser {
  /**
   * Parses the multiline 'Productos' field from Last.app tickets.
   * Preserves exact raw text, extracts quantities, calculates hierarchy depths,
   * and links nested modifiers to parent products.
   */
  public static parse(rawField: string | null | undefined): ParsedProductLine[] {
    if (!rawField || typeof rawField !== 'string') {
      return [];
    }

    const lines = rawField.split(/\r?\n/);
    const parsedLines: ParsedProductLine[] = [];
    let currentParentIndex: number | null = null;

    let lineIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const originalLine = lines[i];
      if (originalLine.trim() === '') {
        continue;
      }

      // Detect depth from leading tabs or spaces
      let depth = 0;
      if (originalLine.startsWith('\t') || originalLine.startsWith('  ')) {
        const leadingTabs = (originalLine.match(/^\t+/) || [''])[0].length;
        const leadingSpaces = (originalLine.match(/^ +/) || [''])[0].length;
        depth = leadingTabs > 0 ? leadingTabs : Math.max(1, Math.floor(leadingSpaces / 2));
      }

      const trimmed = originalLine.trim();

      // Extract quantity, e.g. "1x TACOS - Carnitas" or "2X PERRO" or "0.5x Pan"
      let quantity = 1;
      let displayText = trimmed;
      const matchQty = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*[xX]\s+(.+)$/);
      if (matchQty) {
        const qtyStr = matchQty[1].replace(',', '.');
        const numQty = parseFloat(qtyStr);
        if (!isNaN(numQty) && numQty > 0) {
          quantity = numQty;
        }
        displayText = matchQty[2].trim();
      }

      const itemType: SaleLineItemType = depth > 0 ? 'MODIFIER' : 'PRODUCT';

      let parentLineIndex: number | null = null;
      if (depth === 0) {
        currentParentIndex = lineIndex;
      } else {
        parentLineIndex = currentParentIndex;
      }

      parsedLines.push({
        lineIndex,
        depth,
        parentLineIndex,
        rawText: originalLine,
        displayText,
        quantity,
        itemType,
        notes: depth > 0 ? displayText : null,
      });

      lineIndex++;
    }

    return parsedLines;
  }
}
