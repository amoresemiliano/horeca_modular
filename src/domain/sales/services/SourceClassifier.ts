export type DetectedExportType =
  | 'LASTAPP_INDIVIDUAL_SALES'
  | 'LASTAPP_BILLING_SUMMARY'
  | 'UNKNOWN_UNSUPPORTED';

export interface SourceClassificationResult {
  exportType: DetectedExportType;
  isValidForTicketIngestion: boolean;
  sourceSystem: string;
  confidence: number;
  matchedHeaders: string[];
  missingHeaders: string[];
  rejectionReason?: string;
  diagnostics: string[];
}

export class SourceClassifier {
  private static readonly LASTAPP_INDIVIDUAL_HEADERS = [
    'Ubicación',
    'Código',
    'Fuente',
    'Factura nº',
    'Total',
    'Productos',
    'Hora de creación',
  ];

  private static readonly LASTAPP_BILLING_SUMMARY_HEADERS = [
    'Customer Company Name',
    'Customer Company Tax Id',
    'Customer Company Address',
    'Activation Time',
    'Number',
    'Location Name',
    'Tab Id',
  ];

  private static normalizeHeader(h: string): string {
    return h
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove diacritics (e.g. código -> codigo)
      .replace(/[º°#.]/g, '')
      .replace(/\s+/g, ' ');
  }

  /**
   * Classifies a CSV file based on its headers.
   * Fails closed: any unrecognized or billing summary format is rejected for ticket ingestion.
   */
  public static classify(headers: string[]): SourceClassificationResult {
    if (!headers || headers.length === 0) {
      return {
        exportType: 'UNKNOWN_UNSUPPORTED',
        isValidForTicketIngestion: false,
        sourceSystem: 'unknown',
        confidence: 0,
        matchedHeaders: [],
        missingHeaders: SourceClassifier.LASTAPP_INDIVIDUAL_HEADERS,
        rejectionReason: 'Empty headers or unparseable CSV schema',
        diagnostics: ['The provided file does not contain readable column headers.'],
      };
    }

    const normalizedActual = headers.map(SourceClassifier.normalizeHeader);

    // 1. Check for Last.app Billing / Daily Summary
    const billingMatches = SourceClassifier.LASTAPP_BILLING_SUMMARY_HEADERS.filter(req =>
      normalizedActual.includes(SourceClassifier.normalizeHeader(req))
    );

    if (billingMatches.length >= 3) {
      return {
        exportType: 'LASTAPP_BILLING_SUMMARY',
        isValidForTicketIngestion: false,
        sourceSystem: 'lastapp',
        confidence: billingMatches.length / SourceClassifier.LASTAPP_BILLING_SUMMARY_HEADERS.length,
        matchedHeaders: billingMatches,
        missingHeaders: [],
        rejectionReason: 'Daily/Periodic Billing Summary exports cannot be ingested as individual ticket sales.',
        diagnostics: [
          'Detected Last.app Billing/Summary export format (found: ' + billingMatches.join(', ') + ').',
          'Billing summaries contain aggregate customer invoices rather than individual operational POS tickets.',
          'Rejecting for canonical ticket ingestion as per HORECA Sales domain invariants.',
        ],
      };
    }

    // 2. Check for Last.app Individual Sales Export
    const individualMatches = SourceClassifier.LASTAPP_INDIVIDUAL_HEADERS.filter(req =>
      normalizedActual.includes(SourceClassifier.normalizeHeader(req))
    );

    const matchRatio = individualMatches.length / SourceClassifier.LASTAPP_INDIVIDUAL_HEADERS.length;

    if (matchRatio >= 0.7) {
      return {
        exportType: 'LASTAPP_INDIVIDUAL_SALES',
        isValidForTicketIngestion: true,
        sourceSystem: 'lastapp',
        confidence: matchRatio,
        matchedHeaders: individualMatches,
        missingHeaders: SourceClassifier.LASTAPP_INDIVIDUAL_HEADERS.filter(
          req => !normalizedActual.includes(SourceClassifier.normalizeHeader(req))
        ),
        diagnostics: ['Recognized Last.app Individual Sales Export schema.'],
      };
    }

    // 3. Fall closed
    return {
      exportType: 'UNKNOWN_UNSUPPORTED',
      isValidForTicketIngestion: false,
      sourceSystem: 'unknown',
      confidence: matchRatio,
      matchedHeaders: individualMatches,
      missingHeaders: SourceClassifier.LASTAPP_INDIVIDUAL_HEADERS.filter(
        req => !normalizedActual.includes(SourceClassifier.normalizeHeader(req))
      ),
      rejectionReason: 'Unknown or unsupported CSV layout. Missing required individual sales columns.',
      diagnostics: [
        'Failed to classify CSV as a supported individual sales export format.',
        'Matched columns: [' + individualMatches.join(', ') + '].',
        'Missing expected columns: [' +
          SourceClassifier.LASTAPP_INDIVIDUAL_HEADERS.filter(
            req => !normalizedActual.includes(SourceClassifier.normalizeHeader(req))
          ).join(', ') +
          '].',
      ],
    };
  }
}
