import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPin, pinLookup, verifyPin } from '../../server/personnel/security';
import punchHandler from '../../api/personnel-punch';
import adminHandler from '../../api/personnel';
import { cookieHeader, secureRequest, type Request, type Response } from '../../server/personnel/runtime';

const mocks=vi.hoisted(()=>({rpc:vi.fn(),getUser:vi.fn(),clients:vi.fn()}));
vi.mock('@supabase/supabase-js',()=>({createClient:(...args:unknown[])=>{mocks.clients(...args);return {rpc:mocks.rpc,auth:{getUser:mocks.getUser}};}}));
const pepper='synthetic-test-pepper-at-least-thirty-two-bytes',org='10000000-0000-4000-8000-000000000001',unit='20000000-0000-4000-8000-000000000001';
let stored='';
beforeAll(async()=>{stored=await hashPin('1842',pepper)});
function response(){const result={code:0,body:null as unknown,headers:{} as Record<string,string>,status(code:number){this.code=code;return this;},json(body:unknown){this.body=body;},setHeader(key:string,value:string){this.headers[key]=value;}};return result;}
function request(body:Record<string,unknown>,admin=false):Request{return {method:'POST',headers:{origin:'https://personnel.example.invalid',cookie:'__Host-personnel-device='+ 'A'.repeat(43),...(admin?{authorization:'Bearer synthetic-session'}:{})},body};}
beforeEach(()=>{
 vi.stubEnv('PERSONNEL_BACKEND_ENABLED','true');vi.stubEnv('SUPABASE_URL','https://vmxjqwlfwnphorthhcwu.supabase.co');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic-service-test-only');vi.stubEnv('SUPABASE_ANON_KEY','synthetic-anon-test-only');vi.stubEnv('PERSONNEL_ORIGIN','https://personnel.example.invalid');vi.stubEnv('PERSONNEL_PIN_PEPPER',pepper);
 mocks.rpc.mockReset();mocks.getUser.mockReset();mocks.clients.mockClear();mocks.getUser.mockResolvedValue({data:{user:{id:'synthetic-admin'}},error:null});
 mocks.rpc.mockImplementation(async(name:string,params:Record<string,unknown>)=>{
  if(name==='personnel_admin_allowed')return {data:true,error:null};
  const action=params.p_action;
  if(action==='org')return {data:{org},error:null};
  if(action==='prepare')return {data:{attemptId:'attempt',hash:stored},error:null};
  if(action==='execute')return {data:(params.p_body as {verified:boolean}).verified?{id:'punch',kind:'IN',occurredAt:'2026-11-10T09:00Z',firstName:'Synthetic'}:{error:'PIN_REJECTED'},error:null};
  return {data:{ok:true},error:null};
 });
});
describe('Personnel backend HTTP boundary and scrypt credentials',()=>{
 it('uses salted scrypt, tenant-bound keyed lookup and rejects wrong PIN/pepper',async()=>{
  expect(stored).toMatch(/^scrypt:32768:8:1:/);expect(await verifyPin('1842',stored,pepper)).toBe(true);expect(await verifyPin('9999',stored,pepper)).toBe(false);expect(await verifyPin('1842',stored,pepper+'wrong')).toBe(false);
  expect(await hashPin('1842',pepper)).not.toBe(stored);expect(pinLookup(org,'1842',pepper)).not.toBe(pinLookup(unit,'1842',pepper));
 });
 it('does not require or create an application user for punching and returns no private credential',async()=>{
  const res=response();await punchHandler(request({action:'punch',pin:'1842',requestId:org}),res);
  expect(res.code).toBe(200);expect(res.body).toEqual({id:'punch',kind:'IN',occurredAt:'2026-11-10T09:00Z',firstName:'Synthetic'});
  expect(mocks.getUser).not.toHaveBeenCalled();expect(JSON.stringify(res.body)).not.toContain('scrypt');expect(res.headers['Cache-Control']).toBe('no-store');
 });
 it.each(['employeeId','organizationId','unitId','occurredAt','verified'])('rejects client spoofing of %s before database access',async(key)=>{
  const res=response();await punchHandler(request({action:'punch',pin:'1842',requestId:org,[key]:'spoof'}),res);expect(res.code).toBe(400);expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it('returns generic PIN failure for unsuccessful verification',async()=>{const res=response();await punchHandler(request({action:'punch',pin:'9999',requestId:org}),res);expect(res.body).toEqual({error:'PIN_REJECTED'});});
 it('sets only a secure HttpOnly device cookie after activation',async()=>{
  const res=response();await punchHandler(request({action:'activate',token:'A'.repeat(43)}),res);expect(res.code).toBe(200);expect(res.body).toEqual({ok:true});expect(res.headers['Set-Cookie']).toMatch(/HttpOnly; Secure; SameSite=Strict/);expect(res.headers['Set-Cookie']).toContain('Path=/;');
 });
 it('prevents device credentials from authorizing the admin API',async()=>{const res=response();await adminHandler(request({action:'snapshot',organizationId:org,unitId:unit}),res);expect(res.code).toBe(403);expect(mocks.rpc).not.toHaveBeenCalled();});
 it('requires canonical admin authorization, never active context alone',async()=>{
  mocks.rpc.mockResolvedValue({data:false,error:null});const res=response();await adminHandler(request({action:'snapshot',organizationId:org,unitId:unit},true),res);expect(res.code).toBe(403);expect(mocks.rpc).toHaveBeenCalledWith('personnel_admin_allowed',{org,unit});
 });
 it('fails closed when disabled or cross-origin; cookie cannot become permanent URL state',()=>{
  expect(cookieHeader('secret')).not.toContain('http');expect(()=>secureRequest({...request({}),headers:{origin:'https://foreign.invalid'}},response() as Response)).toThrow('DENIED');
  vi.stubEnv('PERSONNEL_BACKEND_ENABLED','false');expect(()=>secureRequest(request({}),response())).toThrow('SERVER_NOT_CONFIGURED');
 });
});
