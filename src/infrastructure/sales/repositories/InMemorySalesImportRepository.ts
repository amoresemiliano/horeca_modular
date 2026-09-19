import { ISalesImportRepository } from '../../../domain/sales/repositories/ISalesImportRepository';
import { SalesImport } from '../../../domain/sales/models/SalesImport';

export class InMemorySalesImportRepository implements ISalesImportRepository {
  private imports: Map<string, SalesImport> = new Map();

  public async save(salesImport: SalesImport): Promise<void> {
    this.imports.set(salesImport.id, salesImport);
  }

  public async findById(organizationId: string, importId: string): Promise<SalesImport | null> {
    const imp = this.imports.get(importId);
    if (!imp || imp.organizationId !== organizationId) {
      return null;
    }
    return imp;
  }

  public async findByFileHash(organizationId: string, fileHash: string): Promise<SalesImport | null> {
    for (const imp of this.imports.values()) {
      if (imp.organizationId === organizationId && imp.fileHash === fileHash) {
        return imp;
      }
    }
    return null;
  }

  public async listRecent(organizationId: string, limit = 20): Promise<SalesImport[]> {
    const list = Array.from(this.imports.values())
      .filter(i => i.organizationId === organizationId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return list.slice(0, limit);
  }

  public clear(): void {
    this.imports.clear();
  }
}
