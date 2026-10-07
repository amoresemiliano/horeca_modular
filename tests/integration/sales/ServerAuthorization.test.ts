import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({createClient:vi.fn(),getUser:vi.fn(),rpc:vi.fn()}));
vi.mock('@supabase/supabase-js',()=>({createClient:mocks.createClient}));
import handler from '../../../api/sales';
import type { Response } from '../../../server/salesRuntime';
describe('Sales trusted entrypoint Core authorization',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    vi.stubEnv('SUPABASE_URL','https://test.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY','sanitized-anon-key');
    mocks.createClient.mockReturnValue({auth:{getUser:mocks.getUser},rpc:mocks.rpc});
    mocks.getUser.mockResolvedValue({data:{user:{id:'actor'}},error:null});
    mocks.rpc.mockResolvedValue({data:false,error:null});
  });
  function response(){const res={status:vi.fn(),json:vi.fn(),end:vi.fn()};res.status.mockReturnValue(res);return res;}
  it('denies absent caller authentication before service-role composition',async()=>{
    const res=response();await handler({method:'POST',headers:{},body:{action:'sync',organizationId:'org-b'}},res as Response);
    expect(res.status).toHaveBeenCalledWith(403);expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it('uses the requested tenant and current minimum sync capability; false denies',async()=>{
    const res=response();await handler({method:'POST',headers:{authorization:'Bearer sanitized-user-token'},body:{action:'sync',organizationId:'org-b'}},res as Response);
    expect(mocks.getUser).toHaveBeenCalledWith('sanitized-user-token');
    expect(mocks.rpc).toHaveBeenCalledWith('can_execute_capability_for_org',{
      requested_organization_id:'org-b',required_capability_code:'integrations.sync.trigger'});
    expect(res.status).toHaveBeenCalledWith(403);expect(mocks.createClient).toHaveBeenCalledTimes(1);
  });
  it('requires sales.import.process for CSV and denies invalid Auth subjects',async()=>{
    const res=response();await handler({method:'POST',headers:{authorization:'Bearer sanitized-user-token'},body:{action:'csv',organizationId:'org-b'}},res as Response);
    expect(mocks.rpc).toHaveBeenCalledWith('can_execute_capability_for_org',{
      requested_organization_id:'org-b',required_capability_code:'sales.import.process'});
    mocks.getUser.mockResolvedValue({data:{user:null},error:{message:'private source error'}});
    const second=response();await handler({method:'POST',headers:{authorization:'Bearer invalid'},body:{action:'health',organizationId:'org-b'}},second as Response);
    expect(second.json).toHaveBeenCalledWith({error:'DENIED'});
  });
});
