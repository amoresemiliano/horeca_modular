import type { ProductionUnit } from './quantities';

export type BatchStatus = 'DRAFT' | 'CONFIRMED' | 'CORRECTED' | 'REVERSED' | 'CANCELLED';
export type ProductionCommandType = 'create_draft' | 'update_draft' | 'confirm_batch' | 'correct_batch' | 'reverse_batch' | 'cancel_draft' | 'save_policy' | 'log_waste' | 'confirm_waste';

export type OutputDeclaration = {
  line_id: string;
  product_id: string;
  destination_location_id: string;
} & ({ mode: 'PACKAGED'; package_id: string; package_version: string; count: number }
  | { mode: 'LOOSE'; quantity: string; unit: ProductionUnit });

export interface ConsumptionDeclaration {
  line_id: string;
  product_id: string;
  source_location_id: string;
  quantity: string;
  unit: ProductionUnit;
}

export interface ExecutionDeclaration {
  mode: 'MANUAL_OUTPUT' | 'RECIPE_REFERENCE';
  effective_date: string;
  shift?: string;
  notes?: string;
  recipe_id?: string;
  recipe_version?: string;
  outputs: OutputDeclaration[];
  consumptions: ConsumptionDeclaration[];
}

export interface PlanningPolicyDeclaration {
  product_id: string;
  stock_scope: { location_ids: string[] };
  minimum: string;
  maximum: string;
  unit: ProductionUnit;
}

export interface WasteDeclaration {
  waste_id: string;
  product_id: string;
  quantity: string;
  unit: ProductionUnit;
  classification: 'PROCESS_ALREADY_CONSUMED' | 'STOCK_REMOVAL' | 'OUTPUT_LOSS';
  reason: string;
  // Process loss references an explicitly declared input; output loss an output.
  related_line_id?: string;
  location_id?: string;
}

export interface ProductionCommand {
  request_id: string;
  organization_id: string;
  operational_unit_id: string;
  command: ProductionCommandType;
  entity_id: string;
  expected_revision: number;
  body: ExecutionDeclaration | PlanningPolicyDeclaration | WasteDeclaration | { reason: string; execution?: ExecutionDeclaration; waste_id?: string };
}

export interface ProductionCommandResult {
  entity_id: string;
  revision: number;
  status: string;
  execution_id?: string;
}

export interface ProductionOutboxEvent {
  event_id: string;
  schema_version: 1;
  event_type: 'OUTPUT_CONFIRMED' | 'CONSUMPTION_DECLARED' | 'STOCK_WASTE_CONFIRMED' | 'EXECUTION_COMPENSATION_REQUIRED';
  organization_id: string;
  operational_unit_id: string;
  batch_id: string;
  batch_revision: number;
  line_id: string | null;
  command_id: string;
  effective_date: string;
  occurred_at: string;
  actor_profile_id: string;
  correlation_id: string;
  payload: Record<string, unknown>;
  supersedes_event_id: string | null;
  delivery_state: 'PENDING';
}
