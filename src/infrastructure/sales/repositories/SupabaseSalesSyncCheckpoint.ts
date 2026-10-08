import type { SupabaseClient } from '@supabase/supabase-js';
import type { SalesSyncCheckpoint, SalesSyncCheckpointPort } from '../../../application/sales/ports/SalesSyncCheckpointPort.js';
import type { mapLastAppSale } from '../../../application/sales/services/LastAppSalesMapper.js';

export class SupabaseSalesSyncCheckpoint implements SalesSyncCheckpointPort {
  constructor(private readonly client: SupabaseClient,private readonly org: string,private readonly lease: string,public state: SalesSyncCheckpoint) {}
  private async call(name:string,args:Record<string,unknown>) {
    const {data,error}=await this.client.rpc(name,{p_org:this.org,p_run:this.state.id,p_lease:this.lease,...args});
    if(error||!data)throw new Error('SYNC_CHECKPOINT_FAILED');
    this.state=data;
  }
  async savePage(ids:string[],offset:number,exhausted:boolean) {
    await this.call('sales_save_sync_page',{p_ids:ids,p_offset:offset,p_exhausted:exhausted});
  }
  async commitTab(id:string,observation:ReturnType<typeof mapLastAppSale>|null) {
    await this.call('sales_commit_sync_tab',{p_tab:id,p_sale:observation?.sale.toJSON()??null,
      p_lines:observation?.lines.map(l=>l.toJSON())??null,p_bills:observation?.bills??null,p_unmapped:observation?.unmappedProducts??0});
  }
  async finish(failed=false) {await this.call('sales_finish_sync_slice',{p_failed:failed});return this.state;}
}
