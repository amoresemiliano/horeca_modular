import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';import {generateKeyPairSync,randomBytes} from 'node:crypto';
const mocks=vi.hoisted(()=>({send:vi.fn(),rpc:vi.fn(),client:vi.fn(()=>({}))}));
vi.mock('web-push',()=>({sendNotification:mocks.send}));
vi.mock('../../server/personnel/runtime.js',()=>({trustedClient:mocks.client,rpc:mocks.rpc}));
import handler from '../../api/personnel-reminders';
const jwk=generateKeyPairSync('ec',{namedCurve:'prime256v1'}).publicKey.export({format:'jwk'});
const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/synthetic-only',keys:{p256dh:Buffer.concat([Buffer.from([4]),Buffer.from(jwk.x!,'base64url'),Buffer.from(jwk.y!,'base64url')]).toString('base64url'),auth:randomBytes(16).toString('base64url')}};
const response=()=>({code:0,data:null as any,status(code:number){this.code=code;return this;},json(data:any){this.data=data;},setHeader(){}});
describe('Production reminder transport and safe provider accounting',()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('PERSONNEL_CRON_SECRET','synthetic-cron');vi.stubEnv('PERSONNEL_VAPID_PUBLIC_KEY','synthetic-public');vi.stubEnv('PERSONNEL_VAPID_PRIVATE_KEY','synthetic-private');vi.stubEnv('PERSONNEL_VAPID_SUBJECT','https://personnel.example.invalid');mocks.rpc.mockImplementation(async(_client,_name,p)=>p.p_action==='claim'?['synthetic-id']:p.p_action==='prepare'?{subscription,kind:'ENTRY_15',start:'10:00'}:{ok:true});});
 afterEach(()=>vi.unstubAllEnvs());
 it('records real provider success code and sends the neutral final-stage message',async()=>{
  mocks.send.mockResolvedValue({statusCode:201});const res=response();await handler({method:'GET',headers:{authorization:'Bearer synthetic-cron'}},res);expect(res.code).toBe(200);expect(res.data).toEqual({evaluated:1,sent:1});expect(mocks.send).toHaveBeenCalledOnce();
  const payload=JSON.parse(mocks.send.mock.calls[0][1]);expect(payload.body).toContain('recuerda registrar tu entrada');expect(mocks.rpc.mock.calls.at(-1)?.[2]).toMatchObject({p_action:'complete',p_body:{status:'SENT',httpStatus:201}});
 });
 it.each([404,410])('records provider %s for canonical invalid-subscription cleanup',async statusCode=>{
  mocks.send.mockRejectedValue({statusCode});const res=response();await handler({method:'GET',headers:{authorization:'Bearer synthetic-cron'}},res);expect(res.data).toEqual({evaluated:1,sent:0});expect(mocks.rpc.mock.calls.at(-1)?.[2]).toMatchObject({p_action:'complete',p_body:{status:'FAILED',httpStatus:statusCode}});
 });
 it('never sends when the immediate attendance recheck returns no eligible subscription',async()=>{
  mocks.rpc.mockImplementation(async(_c,_n,p)=>p.p_action==='claim'?['synthetic-id']:{});await handler({method:'GET',headers:{authorization:'Bearer synthetic-cron'}},response());expect(mocks.send).not.toHaveBeenCalled();expect(mocks.rpc.mock.calls.at(-1)?.[2]).toMatchObject({p_body:{status:'SKIPPED',httpStatus:null}});
 });
 it('denies a wrong cron secret before any database access',async()=>{const res=response();await handler({method:'GET',headers:{authorization:'Bearer wrong'}},res);expect(res.code).toBe(403);expect(mocks.client).not.toHaveBeenCalled();});
});
