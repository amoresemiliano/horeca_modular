import type { BatchStatus, ProductionCommand, ProductionCommandResult, ProductionOutboxEvent, WasteDeclaration } from '../domain/contracts';
import type { ProductionUnit } from '../domain/quantities';

export interface ProductionScope { organizationId: string; operationalUnitId: string }
export interface OutputSnapshot {
  line_id: string; product_id: string; mode: 'PACKAGED' | 'LOOSE'; package_id: string | null;
  package_version: string | null; unit_count: number | null; quantity: string; unit: ProductionUnit;
  conversion_snapshot: { net_quantity?: string; [key: string]: unknown }; destination_location_id: string;
}
export interface ExecutionSnapshot {
  mode: 'MANUAL_OUTPUT' | 'RECIPE_REFERENCE'; effective_date: string; shift?: string; notes?: string;
  outputs: OutputSnapshot[]; consumptions: { line_id: string; product_id: string; quantity: string; unit: ProductionUnit; source_location_id: string }[];
  ingredient_traceability?: string;
}
export interface BatchRecord {
  id: string; organization_id: string; operational_unit_id: string; effective_date: string; recorded_at: string;
  actor_profile_id: string; status: BatchStatus; revision: number; draft: ExecutionSnapshot;
  current_execution_id: string | null; execution: { snapshot: ExecutionSnapshot } | null;
}
export interface ExecutionRecord {
  id: string; batch_revision: number; action: 'CONFIRM' | 'CORRECT' | 'REVERSE'; snapshot: ExecutionSnapshot;
  supersedes_execution_id: string | null; reason: string | null; actor_profile_id: string; recorded_at: string;
}
export interface WasteRecord extends WasteDeclaration {
  id: string; execution_id: string; actor_profile_id: string; recorded_at: string; confirmed: boolean;
}
export interface PolicyRecord {
  id: string; product_id: string; stock_scope: { location_ids: string[] }; minimum: string; maximum: string;
  unit: ProductionUnit; revision: number;
}
export interface HistoryFilter { date?: string; status?: BatchStatus; productId?: string; cursor?: { recordedAt: string; id: string } }
export interface BatchPage { items: BatchRecord[]; next: HistoryFilter['cursor'] }
export interface BatchDetail {
  batch: BatchRecord; executions: ExecutionRecord[]; wastes: WasteRecord[]; outbox: ProductionOutboxEvent[];
  truncated: boolean;
}
export interface ProductionReadPort {
  history(scope: ProductionScope, filter: HistoryFilter): Promise<BatchPage>;
  policies(scope: ProductionScope, afterId?: string): Promise<{ items: PolicyRecord[]; next?: string }>;
  detail(scope: ProductionScope, id: string): Promise<BatchDetail>;
}
export interface ProductOption {
  id: string; organization_id: string; operational_unit_id?: string; approved: true;
  label: string; base_unit: ProductionUnit; loose_allowed: boolean;
}
export interface PackageOption {
  id: string; version: string; organization_id: string; approved: true; product_id: string;
  label: string; net_quantity: string; unit: ProductionUnit;
}
export interface LocationOption {
  id: string; organization_id: string; operational_unit_id: string; approved: true; label: string;
}
export interface RecipeOption { id: string; version: string; organization_id: string; approved: true; label: string }
export interface OwnerContext {
  available: boolean; products: ProductOption[]; packages: PackageOption[]; locations: LocationOption[];
  recipes: RecipeOption[];
  stock: { policyId: string; actual: string | null; unit: ProductionUnit; organization_id: string; operational_unit_id: string; observedAt: string; version: string }[];
}
export interface ProductionOwnerReadPort { load(scope: ProductionScope): Promise<OwnerContext> }
export const unavailableOwners: ProductionOwnerReadPort = {
  async load() { return { available: false, products: [], packages: [], locations: [], recipes: [], stock: [] }; },
};
export interface ProductionCommandPort { execute(request: ProductionCommand): Promise<ProductionCommandResult> }
export interface ProductionAccess {
  view: boolean; log: boolean; confirm: boolean; correct: boolean; plan: boolean; wasteLog: boolean; wasteConfirm: boolean;
}
