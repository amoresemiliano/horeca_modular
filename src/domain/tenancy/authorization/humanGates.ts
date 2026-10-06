import { Capability } from './capabilities';

export interface HumanGateDefinition {
  readonly gateName: string;
  readonly entryCapability: Capability;
  readonly gatedApprovalCapability: Capability;
  readonly rationale: string;
}

export const HUMAN_GATES: Record<string, HumanGateDefinition> = {
  FINANCIAL_RECONCILIATION: {
    gateName: 'Financial Reconciliation Commitment Gate',
    entryCapability: Capability.FINANCIAL_RECONCILIATION_REVIEW,
    gatedApprovalCapability: Capability.FINANCIAL_RECONCILIATION_CONFIRM,
    rationale: 'Reviewing reconciliation proposals is exploratory; confirming commits irreversible bank allocations.',
  },
  PROCUREMENT_ORDER: {
    gateName: 'Procurement Approval Gate',
    entryCapability: Capability.PURCHASES_ORDER_CREATE,
    gatedApprovalCapability: Capability.PURCHASES_ORDER_APPROVE,
    rationale: 'Drafting orders is separated from managerial financial commitment to suppliers.',
  },
  STOCK_ADJUSTMENT: {
    gateName: 'Inventory Adjustment & Write-off Gate',
    entryCapability: Capability.INVENTORY_COUNT_RUN,
    gatedApprovalCapability: Capability.INVENTORY_ADJUSTMENT_CONFIRM,
    rationale: 'Floor count logging is separated from ledger adjustments and shrinkage write-offs.',
  },
};
