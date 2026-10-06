import { beforeEach, describe, expect, it, vi } from 'vitest';
const { query, from, rpc } = vi.hoisted(() => ({
  query: { select:vi.fn(),eq:vi.fn(),order:vi.fn(),range:vi.fn() }, from:vi.fn(),rpc:vi.fn(),
}));
vi.mock('../../src/lib/supabase.js', () => ({ supabase:{from,rpc} }));
import { fetchConsolidatedMovements, updateAllocationClassification, splitMovementAllocations } from '../../src/lib/extractosService';

describe('Finance UI service (mocked; no hosted access)', () => {
  beforeEach(() => {
    vi.resetAllMocks(); from.mockReturnValue(query);
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.order.mockReturnValue(query);
    rpc.mockResolvedValue({data:null,error:null});
  });
  it('reloads history beyond the first page and fails closed on a later page error',async()=>{
    query.range.mockResolvedValueOnce({data:Array.from({length:500},(_,id)=>({id})),error:null})
      .mockResolvedValueOnce({data:[{id:500}],error:null});
    expect(await fetchConsolidatedMovements('org')).toHaveLength(501);
    expect(query.range).toHaveBeenLastCalledWith(500,999);
    query.range.mockResolvedValueOnce({data:Array(500).fill({}),error:null})
      .mockResolvedValueOnce({data:null,error:new Error('unavailable')});
    await expect(fetchConsolidatedMovements('org')).rejects.toThrow('unavailable');
  });
  it('classification sends explicit organization and only editable fields to the RPC',async()=>{
    await updateAllocationClassification({orgId:'org',allocationId:'allocation',categoryId:'cat',subcategoryId:'sub',counterpartyId:'party',notes:undefined});
    expect(rpc).toHaveBeenCalledWith('rpc_update_bank_allocation',{
      requested_organization_id:'org',allocation_id:'allocation',patch:{category_id:'cat',subcategory_id:'sub',counterparty_id:'party',classification_status:'CONFIRMED'},
    });
    expect(from).not.toHaveBeenCalled();
  });
  it('split rejects blank amounts and propagates server rollback errors',async()=>{
    await expect(splitMovementAllocations('movement',10,[{monto:''}],'org')).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({data:null,error:{message:'Unbalanced split'}});
    await expect(splitMovementAllocations('movement',10,[{monto:'9.99'}],'org')).rejects.toThrow('Unbalanced');
  });
});
