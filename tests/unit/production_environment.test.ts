import { afterEach, describe, expect, it, vi } from 'vitest';
import { appOrigin, checkSupabaseKey, deploymentEnvironment, STAGING_PROJECT_REF, supabaseTarget } from '../../src/shared/config/environmentBoundary';
import { configuration, secureRequest } from '../../server/personnel/runtime';
import { serverClient } from '../../server/salesRuntime';

const prod='p'.repeat(20),origin='https://personnel.example.invalid';
const jwt=(ref:string,role:string)=>'header.'+Buffer.from(JSON.stringify({ref,role})).toString('base64url')+'.synthetic';
afterEach(()=>vi.unstubAllEnvs());
function production(){
 for(const [name,value] of Object.entries({APP_ENV:'production',VERCEL_ENV:'production',SUPABASE_PROJECT_REF:prod,SUPABASE_URL:`https://${prod}.supabase.co`,SUPABASE_SERVICE_ROLE_KEY:jwt(prod,'service_role'),SUPABASE_ANON_KEY:jwt(prod,'anon'),APP_ORIGIN:origin,PERSONNEL_ORIGIN:origin,PERSONNEL_BACKEND_ENABLED:'true',PERSONNEL_PIN_PEPPER:'synthetic-test-only-pepper-32-characters',VITE_APP_ENV:'production',VITE_SUPABASE_URL:`https://${prod}.supabase.co`,VITE_SUPABASE_PROJECT_REF:prod,VITE_APP_ORIGIN:origin}))vi.stubEnv(name,value);
}
describe('Production boundary fails closed before client creation',()=>{
 it('keeps staging default only for non-production',()=>{
  expect(supabaseTarget('uat').projectRef).toBe(STAGING_PROJECT_REF);
  expect(()=>supabaseTarget('production')).toThrow();
  expect(()=>supabaseTarget('production',undefined,prod)).toThrow();
  expect(()=>supabaseTarget('production',`https://${STAGING_PROJECT_REF}.supabase.co`,STAGING_PROJECT_REF)).toThrow();
 });
 it('rejects wrong projects, alternate paths and impersonated hosts',()=>{
  for(const url of [`https://${STAGING_PROJECT_REF}.supabase.co`,`https://${prod}.supabase.co.attacker.invalid`,`https://${prod}.supabase.co/`,`https://user@${prod}.supabase.co`])expect(()=>supabaseTarget('production',url,prod)).toThrow();
  expect(()=>supabaseTarget('uat',`https://${prod}.supabase.co`,prod)).toThrow();
 });
 it('rejects deployments that mix production and preview configuration',()=>{
  expect(()=>deploymentEnvironment('uat','production')).toThrow();
  expect(()=>deploymentEnvironment('production','preview')).toThrow();
  expect(()=>deploymentEnvironment('development',undefined,true)).toThrow('metadata');
  expect(deploymentEnvironment('production','production')).toBe('production');
 });
 it('rejects staging JWTs and service keys in public configuration without disclosing values',()=>{
  expect(()=>checkSupabaseKey(jwt(STAGING_PROJECT_REF,'anon'),prod,'anon')).toThrow('another project');
  expect(()=>checkSupabaseKey(jwt(prod,'service_role'),prod,'anon')).toThrow('role');
  expect(()=>checkSupabaseKey('sb_secret_synthetic',prod,'anon')).toThrow();
  expect(()=>checkSupabaseKey('sb_publishable_synthetic',prod,'anon')).not.toThrow();
 });
 it('requires exact canonical HTTPS origin and blocks the known preview namespace',()=>{
  for(const value of [undefined,'http://example.invalid','https://example.invalid/path','https://example.invalid/','https://horecamodular-git-dev-vegen-s-projects.vercel.app'])expect(()=>appOrigin('production',value)).toThrow();
  expect(appOrigin('production',origin)).toBe(origin);
 });
 it('supports an independent production backend and preserves cross-origin denial',()=>{
  production();expect(configuration().url).toBe(`https://${prod}.supabase.co`);
  const res={status(){return this;},json(){},setHeader(){}};
  expect(()=>secureRequest({method:'POST',headers:{origin:'https://attacker.invalid'},body:{}},res)).toThrow('DENIED');
 });
 it.each(['SUPABASE_PROJECT_REF','SUPABASE_URL','APP_ENV','APP_ORIGIN','VITE_APP_ENV','VITE_APP_ORIGIN','VITE_SUPABASE_URL','VITE_SUPABASE_PROJECT_REF'])('requires aligned production setting %s',name=>{
  production();vi.stubEnv(name,'');expect(()=>configuration()).toThrow('SERVER_NOT_CONFIGURED');
 });
 it('rejects mixed staging credentials at the trusted backend',()=>{
  production();vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY',jwt(STAGING_PROJECT_REF,'service_role'));
  expect(()=>configuration()).toThrow('SERVER_NOT_CONFIGURED');
  expect(()=>serverClient()).toThrow('another project');
 });
 it('also prevents existing non-Personnel server clients from connecting production to staging',()=>{
  production();vi.stubEnv('SUPABASE_URL',`https://${STAGING_PROJECT_REF}.supabase.co`);
  expect(()=>serverClient()).toThrow('does not match');
 });
});
