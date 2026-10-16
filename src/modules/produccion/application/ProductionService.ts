import type { ProductionCommand, ProductionCommandResult } from '../domain/contracts';
import { ProductionError, safeProductionCode } from './errors';

export interface ProductionRpcPort {
  rpc(name: 'production_execute_command', args: { request: ProductionCommand }): PromiseLike<{
    data: ProductionCommandResult | null;
    error: { message: string; code?: string } | null;
  }>;
}

/** Thin transport only: the SQL transaction remains the authorization authority. */
export class ProductionService {
  constructor(private readonly client: ProductionRpcPort) {}
  async execute(request: ProductionCommand): Promise<ProductionCommandResult> {
    const { data, error } = await this.client.rpc('production_execute_command', { request });
    if (error) throw new ProductionError(safeProductionCode(error));
    if (!data) throw new Error('PRODUCTION_RESULT_MISSING');
    return data;
  }
}
