/**
 * HORECA Modular — Finance & Banking Domain Types (WP-FIN-001)
 * Canonical Domain Models & Value Objects
 */

export type ProductType = 'BANK_ACCOUNT' | 'CARD';

export type BankFormatFamily = 
  | 'BBVA_ACCOUNT' 
  | 'BBVA_CARD' 
  | 'SABADELL_ACCOUNT' 
  | 'SABADELL_CARD';

export type MovementDirection = 'DEBIT' | 'CREDIT';

export type DuplicateStatus = 'UNIQUE' | 'POTENTIAL_OVERLAP' | 'DEFINITE_DUPLICATE';

export type ImportStatus = 
  | 'RECEIVED'
  | 'SOURCE_DETECTED'
  | 'PARSED'
  | 'PREVIEW_READY'
  | 'CONFIRMED'
  | 'PERSISTED'
  | 'UNSUPPORTED_FORMAT'
  | 'AMBIGUOUS_SOURCE'
  | 'PARSE_FAILED'
  | 'VALIDATION_FAILED'
  | 'PERSIST_FAILED'
  | 'CANCELLED';

export interface BankAccountMetadata {
  iban?: string | null;
  maskedIdentifier?: string | null;
  contractNumber?: string | null;
  cardIdentifier?: string | null;
  holderName?: string | null;
  currency?: string | null;
}

export interface BankAccount {
  id: string;
  organizationId: string;
  institution: string; // 'BBVA' | 'SABADELL' | ...
  displayName: string;
  productType: ProductType;
  maskedIdentifier: string; // e.g. "•••• 1234"
  externalReference?: string | null; // e.g. Full IBAN or Contract Reference
  currency: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MinimizedSourceProvenance {
  sourceRowNumber: number;
  rawConcept?: string;
  beneficiary?: string;
  observations?: string;
  originalCurrency?: string;
  originalFxAmount?: number;
  bankNativeId?: string;
  reference1?: string;
  reference2?: string;
}

export interface CanonicalBankMovement {
  id?: string;
  organizationId: string;
  bankAccountId: string;
  importId?: string;
  statementId?: string | null;
  bookingDate: string; // ISO YYYY-MM-DD
  valueDate: string | null; // ISO YYYY-MM-DD or null if not in bank extract
  description: string;
  amount: number; // Signed numeric (negative for debit/expense, positive for credit/income)
  currency: string;
  direction: MovementDirection;
  runningBalance: number | null;
  externalReference: string | null;
  sourceRowNumber: number;
  fingerprint: string;
  bankNativeId: string | null;
  duplicateStatus: DuplicateStatus;
  status: 'ACTIVE';
  minimizedProvenance: MinimizedSourceProvenance;
  createdAt?: string;
}

export interface ParsedBankFileResult {
  fileName: string;
  fileHash: string; // SHA-256
  detectedFormat: BankFormatFamily;
  detectedAccountMeta: BankAccountMetadata;
  periodStart: string | null;
  periodEnd: string | null;
  totalRawRows: number;
  movements: Array<{
    sourceRowNumber: number;
    bookingDate: string;
    valueDate: string | null;
    description: string;
    amount: number;
    currency: string;
    direction: MovementDirection;
    runningBalance: number | null;
    bankNativeId: string | null;
    externalReference: string | null;
    minimizedProvenance: MinimizedSourceProvenance;
  }>;
}

export interface ImportPreviewDTO {
  fileName: string;
  fileHash: string;
  formatFamily: BankFormatFamily;
  detectedAccountMeta: BankAccountMetadata;
  resolvedAccountId: string | null;
  resolvedAccountName?: string | null;
  requiresAccountSelection: boolean;
  compatibleAccounts: BankAccount[];
  totalMovements: number;
  totalIncome: number;
  totalExpense: number;
  netAmount: number;
  isExactFileDuplicate: boolean;
  existingImportId?: string | null;
  movements: Array<{
    sourceRowNumber: number;
    bookingDate: string;
    valueDate: string | null;
    description: string;
    amount: number;
    currency: string;
    direction: MovementDirection;
    runningBalance: number | null;
    bankNativeId: string | null;
    fingerprint: string;
    duplicateStatus: DuplicateStatus;
    duplicateReason?: string;
  }>;
}

export interface ImportConfirmationResult {
  importId: string;
  bankAccountId: string;
  totalParsed: number;
  persistedCount: number;
  potentialOverlapCount: number;
  duplicateSuppressedCount: number;
  status: 'COMPLETED';
}
