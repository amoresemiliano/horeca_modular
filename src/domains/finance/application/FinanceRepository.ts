import { BankAccount, BankFormatFamily, CanonicalBankMovement, ImportConfirmationResult, RejectedBankRow } from '../domain/types';

export interface PersistImportInput {
  organizationId: string;
  bankAccountId: string;
  fileName: string;
  fileHash: string;
  sourceFormat: BankFormatFamily;
  movements: CanonicalBankMovement[];
  rejectedRows: RejectedBankRow[];
}

export type FileDuplicate =
  | { isDuplicate: false }
  | { isDuplicate: true; file: { import_id: string; bank_account_id: string } };

export interface FinanceRepository {
  requireConfirmationAuthorization(organizationId: string): Promise<void>;
  fetchBankAccounts(organizationId: string): Promise<BankAccount[]>;
  checkFileDuplicate(fileHash: string, organizationId: string): Promise<FileDuplicate>;
  fetchExistingFingerprints(fingerprints: string[], organizationId: string): Promise<Set<string>>;
  persistConfirmedImport(input: PersistImportInput): Promise<ImportConfirmationResult>;
}
