import type { SalesSyncEvidence } from '../useCases/SyncSalesSourceUseCase';
import type { mapLastAppSale } from '../services/LastAppSalesMapper';

export interface SalesSyncCheckpoint extends SalesSyncEvidence {
  id: string; next_offset: number; pending_tab_ids: string[]; source_exhausted: boolean;
  continuation_version: number; status: string;
}
export interface SalesSyncCheckpointPort {
  state: SalesSyncCheckpoint;
  savePage(ids: string[], nextOffset: number, exhausted: boolean): Promise<void>;
  /** Canonical mutation and checkpoint advancement commit together, under the slice lease. */
  commitTab(id: string, observation: ReturnType<typeof mapLastAppSale> | null): Promise<void>;
}
