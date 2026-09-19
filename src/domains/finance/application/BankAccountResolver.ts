/**
 * HORECA Modular — Bank Account Resolver (WP-FIN-001)
 * Resolves concrete BankAccount identity from detected format and metadata,
 * ensuring BBVA Account A and B resolve independently without guessing.
 */

import { BankAccount, BankFormatFamily, BankAccountMetadata, ProductType } from '../domain/types';

export interface AccountResolutionResult {
  resolvedAccount: BankAccount | null;
  requiresSelection: boolean;
  compatibleAccounts: BankAccount[];
  resolutionReason: string;
}

export function resolveBankAccount(
  formatFamily: BankFormatFamily,
  metadata: BankAccountMetadata,
  availableAccounts: BankAccount[]
): AccountResolutionResult {
  // Determine expected product type and institution
  let expectedInstitution = 'BBVA';
  let expectedProductType: ProductType = 'BANK_ACCOUNT';

  if (formatFamily === 'BBVA_ACCOUNT') {
    expectedInstitution = 'BBVA';
    expectedProductType = 'BANK_ACCOUNT';
  } else if (formatFamily === 'BBVA_CARD') {
    expectedInstitution = 'BBVA';
    expectedProductType = 'CARD';
  } else if (formatFamily === 'SABADELL_ACCOUNT') {
    expectedInstitution = 'SABADELL';
    expectedProductType = 'BANK_ACCOUNT';
  } else if (formatFamily === 'SABADELL_CARD') {
    expectedInstitution = 'SABADELL';
    expectedProductType = 'CARD';
  }

  // Filter accounts belonging to this institution and product type
  const compatible = availableAccounts.filter(acc => 
    acc.isActive &&
    acc.institution.toUpperCase() === expectedInstitution.toUpperCase() &&
    acc.productType === expectedProductType
  );

  if (compatible.length === 0) {
    return {
      resolvedAccount: null,
      requiresSelection: true,
      compatibleAccounts: availableAccounts.filter(a => a.isActive),
      resolutionReason: `No hay cuentas bancarias activas registradas para ${expectedInstitution} (${expectedProductType}).`
    };
  }

  // 1. Try matching by IBAN
  if (metadata.iban) {
    const cleanIban = metadata.iban.replace(/\s+/g, '').toUpperCase();
    const matchedByIban = compatible.find(a => 
      a.externalReference && a.externalReference.replace(/\s+/g, '').toUpperCase() === cleanIban
    );
    if (matchedByIban) {
      return {
        resolvedAccount: matchedByIban,
        requiresSelection: false,
        compatibleAccounts: compatible,
        resolutionReason: `Identificada automáticamente por IBAN (${metadata.maskedIdentifier || cleanIban.slice(-4)})`
      };
    }
  }

  // 2. Try matching by contract or card reference
  if (metadata.contractNumber || metadata.cardIdentifier) {
    const ref = (metadata.contractNumber || metadata.cardIdentifier || '').trim();
    const matchedByRef = compatible.find(a => 
      a.externalReference && a.externalReference.includes(ref.slice(-8))
    );
    if (matchedByRef) {
      return {
        resolvedAccount: matchedByRef,
        requiresSelection: false,
        compatibleAccounts: compatible,
        resolutionReason: `Identificada automáticamente por referencia de contrato/tarjeta`
      };
    }
  }

  // 3. If exactly 1 compatible account exists in the organization
  if (compatible.length === 1) {
    return {
      resolvedAccount: compatible[0],
      requiresSelection: false,
      compatibleAccounts: compatible,
      resolutionReason: `Única cuenta compatible (${compatible[0].displayName})`
    };
  }

  // 4. Multiple compatible accounts exist (e.g. BBVA Account MC vs MT) -> Ask user to select
  return {
    resolvedAccount: null,
    requiresSelection: true,
    compatibleAccounts: compatible,
    resolutionReason: `Múltiples cuentas compatibles encontradas para ${expectedInstitution}. Selecciona la cuenta de destino.`
  };
}
