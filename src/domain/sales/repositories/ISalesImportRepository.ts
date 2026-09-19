import { SalesImport } from '../models/SalesImport';

export interface ISalesImportRepository {
  save(salesImport: SalesImport): Promise<void>;
  findById(organizationId: string, importId: string): Promise<SalesImport | null>;
  findByFileHash(organizationId: string, fileHash: string): Promise<SalesImport | null>;
  listRecent(organizationId: string, limit?: number): Promise<SalesImport[]>;
}
