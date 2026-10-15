import type { ProductionCommand, ProductionCommandResult } from '../domain/contracts';

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
    if (error) throw new Error(error.code || 'PRODUCTION_COMMAND_FAILED');
    if (!data) throw new Error('PRODUCTION_RESULT_MISSING');
    return data;
  }
}
